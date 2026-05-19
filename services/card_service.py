import json
from models.database import get_db
from services.config_service import get_active_import_id
from config import LEVEL1_COLUMN, LEVEL3_COLUMN


def get_cards(import_id=None, page=1, page_size=20, filters=None, keyword=None, active_level2=''):
    if not import_id:
        import_id = get_active_import_id()
    if not import_id:
        return {'total': 0, 'page': page, 'cards': []}

    conn = get_db()
    try:
        configs = conn.execute(
            """SELECT column_name, display_name, is_visible, is_filterable,
                      display_order, is_primary, field_type
               FROM column_configs WHERE import_id=? ORDER BY display_order""",
            (import_id,)
        ).fetchall()
        configs = [dict(c) for c in configs]
        visible_cols = [c for c in configs if c['is_visible']]
        tag_cols = [c for c in configs if c['is_filterable']]

        # === Build SQL WHERE with filters + keyword pushed down to SQL ===
        conditions = ['import_id = ?']
        params = [import_id]

        if keyword:
            conditions.append('LOWER(data) LIKE ?')
            params.append(f'%{keyword.lower()}%')

        if filters:
            for col, values in filters.items():
                if values:
                    # Escape double quotes in column name for JSON path
                    safe_col = col.replace('"', '""')
                    placeholders = ','.join(['?'] * len(values))
                    conditions.append(
                        f'json_extract(data, \'$.{safe_col}\') IN ({placeholders})'
                    )
                    params.extend(values)

        where_clause = ' AND '.join(conditions)

        # === COUNT total (after filtering) ===
        total = conn.execute(
            f'SELECT COUNT(*) as cnt FROM cards WHERE {where_clause}',
            params
        ).fetchone()['cnt']

        # === Paginated query ===
        offset = (page - 1) * page_size
        cards = conn.execute(
            f'SELECT id, data, images FROM cards WHERE {where_clause} ORDER BY id LIMIT ? OFFSET ?',
            params + [page_size, offset]
        ).fetchall()

        # === Build result ===
        result = []
        for card in cards:
            data = json.loads(card['data'])

            fields = []
            for cfg in visible_cols:
                fields.append({
                    'name': cfg['column_name'],
                    'display_name': cfg['display_name'] or cfg['column_name'],
                    'value': data.get(cfg['column_name'], ''),
                    'is_primary': bool(cfg['is_primary']),
                    'field_type': cfg['field_type'],
                    'display_order': cfg['display_order']
                })

            tags = []
            for cfg in tag_cols:
                val = data.get(cfg['column_name'], '')
                if val:
                    tags.append({
                        'column': cfg['column_name'],
                        'display_name': cfg['display_name'] or cfg['column_name'],
                        'value': val
                    })

            result.append({
                'id': card['id'],
                '_level1': data.get(LEVEL1_COLUMN, ''),
                'fields': fields,
                'tags': tags,
                'data': data
            })

        # === Batch resolve image_map ===
        if result:
            level1_set = {c['_level1'] for c in result if c['_level1']}
            if level1_set:
                placeholders = ','.join(['?'] * len(level1_set))
                rows = conn.execute(
                    'SELECT level1, level2, level3, file_path '
                    'FROM media_assets '
                    'WHERE level1 IN ({0})'.format(placeholders),
                    list(level1_set)
                ).fetchall()
                l1_map = {}
                for row in rows:
                    l1 = row['level1']
                    l2 = row['level2']
                    l3 = row['level3']
                    url = '/uploads/images/media/{0}'.format(row['file_path'])
                    if l1 not in l1_map:
                        l1_map[l1] = {}
                    if l2 not in l1_map[l1]:
                        l1_map[l1][l2] = {}
                    l1_map[l1][l2][l3] = url
            else:
                l1_map = {}

            for c in result:
                c['image_map'] = l1_map.get(c['_level1'], {})
        else:
            l1_map = {}

        for c in result:
            del c['_level1']

        return {'total': total, 'page': page, 'page_size': page_size, 'cards': result}
    finally:
        conn.close()


def get_filters(import_id=None):
    if not import_id:
        import_id = get_active_import_id()
    if not import_id:
        return []

    conn = get_db()
    try:
        filterable = conn.execute(
            """SELECT column_name, display_name FROM column_configs
               WHERE import_id=? AND is_filterable=1 ORDER BY display_order""",
            (import_id,)
        ).fetchall()

        result = []
        for col in filterable:
            options = conn.execute(
                """SELECT value, card_count FROM filter_options
                   WHERE import_id=? AND column_name=? ORDER BY value""",
                (import_id, col['column_name'])
            ).fetchall()
            result.append({
                'column': col['column_name'],
                'display_name': col['display_name'] or col['column_name'],
                'options': [{'value': o['value'], 'count': o['card_count']} for o in options]
            })
        return result
    finally:
        conn.close()


def get_admin_cards(import_id=None, page=1, page_size=30):
    if not import_id:
        import_id = get_active_import_id()
    if not import_id:
        return {'total': 0, 'page': page, 'cards': []}

    conn = get_db()
    try:
        total = conn.execute(
            'SELECT COUNT(*) as cnt FROM cards WHERE import_id=?', (import_id,)
        ).fetchone()['cnt']

        offset = (page - 1) * page_size
        cards = conn.execute(
            'SELECT id, row_index, data FROM cards WHERE import_id=? ORDER BY id LIMIT ? OFFSET ?',
            (import_id, page_size, offset)
        ).fetchall()

        result = []
        for card in cards:
            data = json.loads(card['data'])
            result.append({
                'id': card['id'],
                'row_index': card['row_index'],
                'data': data
            })
        return {'total': total, 'page': page, 'page_size': page_size, 'cards': result}
    finally:
        conn.close()
