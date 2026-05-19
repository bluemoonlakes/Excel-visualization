import os
import re
import uuid
import json
from models.database import get_db
from config import UPLOAD_MEDIA, ALLOWED_IMAGE_EXTENSIONS, MAX_IMAGE_SIZE, IMAGE_QUALITY


def parse_media_filename(filename):
    """
    Parse image filename into three-level tags.

    Format: {level1}_{level2}_{description}({level3}).ext
    Example: question_service_some desc_001(Yang).jpg
    Chinese example: problem_intro_description_001(Yang).jpg

    Returns dict:
        level1, level2, level3, description, warnings (list)
    """
    warnings = []
    name, _ = os.path.splitext(filename)

    # Extract level3 from trailing brackets: (xxx) or (xxx) [Chinese/English both supported]
    level3 = ''
    bracket_match = re.search(r'[\uff08(]([^\uff09)]+)[\uff09)]$', name)
    if bracket_match:
        level3 = bracket_match.group(1).strip()
        name = name[:bracket_match.start()].strip()
    else:
        warnings.append('No bracket found for level3 (team tag). level3 set to empty.')

    # Split by underscore to get level1, level2, description
    parts = name.split('_')
    level1 = parts[0].strip() if len(parts) > 0 else ''
    level2 = parts[1].strip() if len(parts) > 1 else ''
    description = '_'.join(parts[2:]).strip() if len(parts) > 2 else ''

    if not level1:
        warnings.append('level1 (customer question type) is empty.')
    if not level2:
        warnings.append('level2 (material type) is empty.')

    return {
        'level1': level1,
        'level2': level2,
        'level3': level3,
        'description': description,
        'warnings': warnings
    }


def save_media_file(f):
    """
    Save uploaded image file to UPLOAD_MEDIA directory.
    Returns (rel_path, file_size).
    """
    os.makedirs(UPLOAD_MEDIA, exist_ok=True)
    ext = os.path.splitext(f.filename)[1].lower()
    filename = '{0}{1}'.format(uuid.uuid4().hex, ext)
    save_path = os.path.join(UPLOAD_MEDIA, filename)
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
    file_size = os.path.getsize(save_path)
    return filename, file_size


def get_level2_options():
    """Return all distinct level2 values from media_assets."""
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT DISTINCT level2 FROM media_assets WHERE level2 != '' ORDER BY level2"
        ).fetchall()
        return [r['level2'] for r in rows]
    finally:
        conn.close()


def upsert_media_asset(conn, original_filename, level1, level2, level3,
                       description, file_path, file_size):
    """
    Insert or replace a media asset.
    If (level1, level2, level3) already exists, delete old file and replace.
    Returns status: 'created' or 'replaced'.
    """
    existing = conn.execute(
        "SELECT id, file_path FROM media_assets WHERE level1=? AND level2=? AND level3=?",
        (level1, level2, level3)
    ).fetchone()

    status = 'created'
    if existing:
        # Delete old file
        old_path = os.path.join(UPLOAD_MEDIA, existing['file_path'])
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass
        conn.execute(
            """UPDATE media_assets
               SET original_filename=?, file_path=?, file_size=?, description=?,
                   created_at=CURRENT_TIMESTAMP
               WHERE level1=? AND level2=? AND level3=?""",
            (original_filename, file_path, file_size, description, level1, level2, level3)
        )
        status = 'replaced'
    else:
        conn.execute(
            """INSERT INTO media_assets
               (original_filename, level1, level2, level3, description, file_path, file_size)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (original_filename, level1, level2, level3, description, file_path, file_size)
        )
    return status


def resolve_media_url(level1, level2, level3):
    """
    Find the matching media URL for a combination of three-level tags.
    Returns URL string or None.
    """
    if not (level1 and level2 and level3):
        return None
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT file_path FROM media_assets WHERE level1=? AND level2=? AND level3=?",
            (level1, level2, level3)
        ).fetchone()
        if row:
            return '/uploads/images/media/{0}'.format(row['file_path'])
        return None
    finally:
        conn.close()


def batch_resolve_media_urls(combos, active_level2):
    """
    Batch resolve media URLs for a list of (level1, level3) tuples,
    all using the same active_level2.

    Returns a dict: {(level1, level3): url_or_None}
    """
    if not active_level2 or not combos:
        return {combo: None for combo in combos}

    # Deduplicate
    unique_combos = list(set(combos))

    conn = get_db()
    try:
        # Build placeholders for IN clause
        placeholders = ','.join(['(?, ?, ?)'] * len(unique_combos))
        params = []
        for (l1, l3) in unique_combos:
            params.extend([l1, active_level2, l3])

        rows = conn.execute(
            "SELECT level1, level3, file_path FROM media_assets WHERE (level1, level2, level3) IN ({0})".format(placeholders),
            params
        ).fetchall()

        result = {combo: None for combo in unique_combos}
        for row in rows:
            key = (row['level1'], row['level3'])
            result[key] = '/uploads/images/media/{0}'.format(row['file_path'])
        return result
    finally:
        conn.close()
