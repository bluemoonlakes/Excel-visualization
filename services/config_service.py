from models.database import get_db

def get_active_import_id():
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT value FROM app_settings WHERE key='active_import_id'"
        ).fetchone()
        if row and row['value']:
            return int(row['value'])
        # fallback: 取最新 active 的导入
        row = conn.execute(
            "SELECT id FROM excel_imports WHERE status='active' ORDER BY id DESC LIMIT 1"
        ).fetchone()
        return row['id'] if row else None
    finally:
        conn.close()

def get_display_config(import_id):
    conn = get_db()
    try:
        cols = conn.execute(
            """SELECT column_name, display_name, is_visible, is_filterable,
                      display_order, is_primary, field_type
               FROM column_configs
               WHERE import_id=?
               ORDER BY display_order""",
            (import_id,)
        ).fetchall()
        return [dict(c) for c in cols]
    finally:
        conn.close()

def update_columns(import_id, columns):
    """
    批量更新列配置。columns 是列表，每项包含 column_name 和可选字段。
    """
    conn = get_db()
    try:
        for col in columns:
            conn.execute(
                """UPDATE column_configs
                   SET display_name=?, is_visible=?, is_filterable=?,
                       display_order=?, is_primary=?, field_type=?
                   WHERE import_id=? AND column_name=?""",
                (
                    col.get('display_name', col['column_name']),
                    int(col.get('is_visible', 1)),
                    int(col.get('is_filterable', 0)),
                    int(col.get('display_order', 0)),
                    int(col.get('is_primary', 0)),
                    col.get('field_type', 'text'),
                    import_id,
                    col['column_name']
                )
            )
        # 重建 filter_options（仅针对 is_filterable=1 的列）
        _rebuild_filter_options(conn, import_id)
        conn.commit()
    finally:
        conn.close()

def _rebuild_filter_options(conn, import_id):
    import json
    # 删除旧的
    conn.execute("DELETE FROM filter_options WHERE import_id=?", (import_id,))

    # 找出所有 is_filterable=1 的列
    filterable_cols = conn.execute(
        "SELECT column_name FROM column_configs WHERE import_id=? AND is_filterable=1",
        (import_id,)
    ).fetchall()
    filterable_cols = [r['column_name'] for r in filterable_cols]

    if not filterable_cols:
        return

    # 读取所有卡片数据
    cards = conn.execute(
        "SELECT data FROM cards WHERE import_id=?", (import_id,)
    ).fetchall()

    from collections import Counter
    col_counters = {col: Counter() for col in filterable_cols}
    for card in cards:
        data = json.loads(card['data'])
        for col in filterable_cols:
            val = data.get(col, '')
            if val:
                col_counters[col][val] += 1

    for col, counter in col_counters.items():
        for val, cnt in counter.items():
            conn.execute(
                """INSERT OR IGNORE INTO filter_options
                   (import_id, column_name, value, card_count)
                   VALUES (?, ?, ?, ?)""",
                (import_id, col, val, cnt)
            )
