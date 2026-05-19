import os
import uuid
import json
from flask import Blueprint, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
from config import (UPLOAD_EXCELS, UPLOAD_IMAGES, UPLOAD_MEDIA,
                    ALLOWED_EXCEL_EXTENSIONS, ALLOWED_IMAGE_EXTENSIONS,
                    MAX_IMAGE_SIZE, IMAGE_QUALITY)
from models.database import get_db
from services.excel_parser import parse_and_import
from services.config_service import get_display_config, update_columns, get_active_import_id
from services.card_service import get_admin_cards
from services.media_service import parse_media_filename, save_media_file, upsert_media_asset

admin_bp = Blueprint('admin', __name__)

def _allowed_ext(filename, allowed):
    ext = os.path.splitext(filename)[1].lower()
    return ext in allowed

def _save_image_file(f, card_id):
    """保存图片文件到旧的 card 目录，返回相对路径（保留兼容）"""
    ext = os.path.splitext(f.filename)[1].lower()
    img_filename = "{0}{1}".format(uuid.uuid4().hex, ext)
    card_dir = os.path.join(UPLOAD_IMAGES, str(card_id))
    os.makedirs(card_dir, exist_ok=True)
    save_path = os.path.join(card_dir, img_filename)
    try:
        from PIL import Image
        img = Image.open(f)
        if ext in ('.jpg', '.jpeg'):
            img = img.convert('RGB')
        img.thumbnail(MAX_IMAGE_SIZE, Image.LANCZOS)
        img.save(save_path, quality=IMAGE_QUALITY, optimize=True)
    except Exception:
        f.seek(0)
        f.save(save_path)
    return "{0}/{1}".format(card_id, img_filename)

# ─── 页面 ────────────────────────────────────────────────────────────────────

@admin_bp.route('/admin')
def admin_page():
    return render_template('admin.html')

# ─── Excel 导入 ──────────────────────────────────────────────────────────────

@admin_bp.route('/api/admin/import', methods=['POST'])
def import_excel():
    if 'file' not in request.files:
        return jsonify({'error': '未上传文件'}), 400
    f = request.files['file']
    if not f.filename or not _allowed_ext(f.filename, ALLOWED_EXCEL_EXTENSIONS):
        return jsonify({'error': '仅支持 .xlsx / .xls 文件'}), 400

    orig_ext = os.path.splitext(f.filename)[1].lower()
    safe_name = secure_filename(f.filename)
    if not safe_name or safe_name == orig_ext.lstrip('.'):
        safe_name = 'upload'
    else:
        safe_name = os.path.splitext(safe_name)[0]
    unique_name = "{0}_{1}{2}".format(safe_name, uuid.uuid4().hex[:8], orig_ext)
    filepath = os.path.join(UPLOAD_EXCELS, unique_name)
    f.save(filepath)

    try:
        result = parse_and_import(filepath, f.filename)
        return jsonify({'success': True, **result})
    except Exception as e:
        return jsonify({'error': '解析失败：{0}'.format(str(e))}), 500

@admin_bp.route('/api/admin/imports', methods=['GET'])
def list_imports():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, filename, imported_at, row_count, status FROM excel_imports ORDER BY id DESC"
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()

@admin_bp.route('/api/admin/imports/<int:import_id>', methods=['DELETE'])
def delete_import(import_id):
    conn = get_db()
    try:
        conn.execute("DELETE FROM excel_imports WHERE id=?", (import_id,))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()

# ─── 列配置 ──────────────────────────────────────────────────────────────────

@admin_bp.route('/api/admin/columns/<int:import_id>', methods=['GET'])
def get_columns(import_id):
    cols = get_display_config(import_id)
    return jsonify(cols)

@admin_bp.route('/api/admin/columns/<int:import_id>', methods=['PUT'])
def save_columns(import_id):
    data = request.get_json()
    if not data or not isinstance(data, list):
        return jsonify({'error': '参数错误'}), 400
    update_columns(import_id, data)
    return jsonify({'success': True})

# ─── 卡片管理 ────────────────────────────────────────────────────────────────

@admin_bp.route('/api/admin/cards', methods=['GET'])
def admin_cards():
    import_id = request.args.get('import_id', type=int) or get_active_import_id()
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 30, type=int)
    result = get_admin_cards(import_id, page, page_size)
    return jsonify(result)

# ─── 素材库 API ───────────────────────────────────────────────────────────────

@admin_bp.route('/api/admin/media/upload', methods=['POST'])
def upload_media():
    """批量上传素材图片，自动解析文件名三级标签。支持 files[] 多文件。"""
    files = request.files.getlist('files[]')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': '未上传文件'}), 400

    results = []
    conn = get_db()
    try:
        for f in files:
            if not f.filename:
                continue
            if not _allowed_ext(f.filename, ALLOWED_IMAGE_EXTENSIONS):
                results.append({'filename': f.filename, 'error': '不支持的文件格式'})
                continue

            parsed = parse_media_filename(f.filename)
            try:
                rel_path, file_size = save_media_file(f)
            except Exception as e:
                results.append({'filename': f.filename, 'error': '保存失败：{0}'.format(str(e))})
                continue

            status = upsert_media_asset(
                conn,
                original_filename=f.filename,
                level1=parsed['level1'],
                level2=parsed['level2'],
                level3=parsed['level3'],
                description=parsed['description'],
                file_path=rel_path,
                file_size=file_size
            )
            results.append({
                'filename': f.filename,
                'level1': parsed['level1'],
                'level2': parsed['level2'],
                'level3': parsed['level3'],
                'description': parsed['description'],
                'url': '/uploads/images/media/{0}'.format(rel_path),
                'status': status,
                'warnings': parsed['warnings']
            })
        conn.commit()
    finally:
        conn.close()

    return jsonify(results)


@admin_bp.route('/api/admin/media', methods=['GET'])
def list_media():
    """素材库列表，支持三级标签筛选 + 关键词 + 分页。"""
    level1 = request.args.get('level1', '').strip()
    level2 = request.args.get('level2', '').strip()
    level3 = request.args.get('level3', '').strip()
    keyword = request.args.get('keyword', '').strip()
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 30, type=int)

    conn = get_db()
    try:
        conditions = []
        params = []
        if level1:
            conditions.append("level1=?")
            params.append(level1)
        if level2:
            conditions.append("level2=?")
            params.append(level2)
        if level3:
            conditions.append("level3=?")
            params.append(level3)
        if keyword:
            conditions.append("(original_filename LIKE ? OR description LIKE ?)")
            params.extend(['%{0}%'.format(keyword), '%{0}%'.format(keyword)])

        where = ('WHERE ' + ' AND '.join(conditions)) if conditions else ''
        total = conn.execute(
            "SELECT COUNT(*) as cnt FROM media_assets {0}".format(where), params
        ).fetchone()['cnt']

        offset = (page - 1) * page_size
        rows = conn.execute(
            "SELECT id, original_filename, level1, level2, level3, description, file_path, file_size, created_at "
            "FROM media_assets {0} ORDER BY id DESC LIMIT ? OFFSET ?".format(where),
            params + [page_size, offset]
        ).fetchall()

        items = []
        for row in rows:
            items.append({
                'id': row['id'],
                'original_filename': row['original_filename'],
                'level1': row['level1'],
                'level2': row['level2'],
                'level3': row['level3'],
                'description': row['description'],
                'url': '/uploads/images/media/{0}'.format(row['file_path']),
                'file_size': row['file_size'],
                'created_at': row['created_at']
            })
        return jsonify({'total': total, 'page': page, 'page_size': page_size, 'items': items})
    finally:
        conn.close()


@admin_bp.route('/api/admin/media/tags', methods=['GET'])
def media_tags():
    """返回素材库中所有三个维度的可用标签（用于筛选器渲染）。"""
    conn = get_db()
    try:
        l1 = conn.execute("SELECT DISTINCT level1 FROM media_assets WHERE level1!='' ORDER BY level1").fetchall()
        l2 = conn.execute("SELECT DISTINCT level2 FROM media_assets WHERE level2!='' ORDER BY level2").fetchall()
        l3 = conn.execute("SELECT DISTINCT level3 FROM media_assets WHERE level3!='' ORDER BY level3").fetchall()
        return jsonify({
            'level1_options': [r['level1'] for r in l1],
            'level2_options': [r['level2'] for r in l2],
            'level3_options': [r['level3'] for r in l3],
        })
    finally:
        conn.close()


@admin_bp.route('/api/admin/media/<int:media_id>', methods=['DELETE'])
def delete_media(media_id):
    """删除指定素材（磁盘文件 + 数据库记录）。"""
    conn = get_db()
    try:
        row = conn.execute("SELECT file_path FROM media_assets WHERE id=?", (media_id,)).fetchone()
        if not row:
            return jsonify({'error': '素材不存在'}), 404
        file_path = os.path.join(UPLOAD_MEDIA, row['file_path'])
        if os.path.exists(file_path):
            os.remove(file_path)
        conn.execute("DELETE FROM media_assets WHERE id=?", (media_id,))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()

# ─── 静态图片服务 ─────────────────────────────────────────────────────────────

@admin_bp.route('/uploads/images/media/<path:filepath>')
def serve_media(filepath):
    return send_from_directory(UPLOAD_MEDIA, filepath)

@admin_bp.route('/uploads/images/<path:filepath>')
def serve_image(filepath):
    return send_from_directory(UPLOAD_IMAGES, filepath)
