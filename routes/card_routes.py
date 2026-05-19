import json
from flask import Blueprint, request, jsonify
from models.database import get_db
from services.card_service import get_cards, get_filters
from services.config_service import get_display_config, get_active_import_id
from services.media_service import get_level2_options

card_bp = Blueprint('cards', __name__)

# ─── 卡片列表 ─────────────────────────────────────────────────────────────────

@card_bp.route('/api/cards', methods=['GET'])
def api_cards():
    import_id = request.args.get('import_id', type=int) or get_active_import_id()
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    keyword = request.args.get('keyword', '').strip() or None
    active_level2 = request.args.get('level2', '').strip()

    filters_raw = request.args.get('filters', '')
    filters = None
    if filters_raw:
        try:
            filters = json.loads(filters_raw)
        except Exception:
            filters = None

    result = get_cards(import_id, page, page_size, filters, keyword, active_level2)
    return jsonify(result)

# ─── 筛选维度 ─────────────────────────────────────────────────────────────────

@card_bp.route('/api/filters', methods=['GET'])
def api_filters():
    import_id = request.args.get('import_id', type=int) or get_active_import_id()
    result = get_filters(import_id)
    return jsonify(result)

# ─── 展示字段配置 ─────────────────────────────────────────────────────────────

@card_bp.route('/api/config/display', methods=['GET'])
def api_display_config():
    import_id = request.args.get('import_id', type=int) or get_active_import_id()
    if not import_id:
        return jsonify([])
    return jsonify(get_display_config(import_id))

# ─── 素材库标签维度（展示页用） ───────────────────────────────────────────────

@card_bp.route('/api/media/tags', methods=['GET'])
def api_media_tags():
    """Return distinct level2 options for the display page level2 switcher."""
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

# ─── 图片显示规则（保留，已不在前端使用） ─────────────────────────────────────

@card_bp.route('/api/image-rules', methods=['GET'])
def get_image_rules():
    import_id = request.args.get('import_id', type=int) or get_active_import_id()
    conn = get_db()
    try:
        setting = conn.execute(
            "SELECT value FROM app_settings WHERE key='default_img_index'"
        ).fetchone()
        default_img_index = int(setting['value']) if setting else -1

        if import_id:
            rules = conn.execute(
                "SELECT id, column_name, value, img_index FROM image_visibility_rules WHERE import_id=? ORDER BY id",
                (import_id,)
            ).fetchall()
            rules = [dict(r) for r in rules]
        else:
            rules = []

        return jsonify({
            'default_img_index': default_img_index,
            'rules': rules,
            'import_id': import_id
        })
    finally:
        conn.close()

@card_bp.route('/api/image-rules', methods=['PUT'])
def save_image_rules():
    data = request.get_json()
    if not data:
        return jsonify({'error': '参数错误'}), 400

    import_id = data.get('import_id') or get_active_import_id()
    default_img_index = int(data.get('default_img_index', -1))
    rules = data.get('rules', [])

    conn = get_db()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('default_img_index', ?)",
            (str(default_img_index),)
        )
        if import_id:
            conn.execute("DELETE FROM image_visibility_rules WHERE import_id=?", (import_id,))
            for rule in rules:
                col = rule.get('column_name', '').strip()
                val = rule.get('value', '').strip()
                idx = int(rule.get('img_index', -1))
                if col and val:
                    conn.execute(
                        "INSERT INTO image_visibility_rules (import_id, column_name, value, img_index) VALUES (?, ?, ?, ?)",
                        (import_id, col, val, idx)
                    )
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()
