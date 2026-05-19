import sqlite3
import os
from config import DATABASE_PATH

def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    c.executescript("""
        CREATE TABLE IF NOT EXISTS excel_imports (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            filename    TEXT NOT NULL,
            filepath    TEXT NOT NULL,
            imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            row_count   INTEGER,
            status      TEXT DEFAULT 'active'
        );

        CREATE TABLE IF NOT EXISTS cards (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            import_id   INTEGER REFERENCES excel_imports(id) ON DELETE CASCADE,
            row_index   INTEGER,
            data        TEXT NOT NULL,
            images      TEXT DEFAULT '[]',
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS column_configs (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            import_id      INTEGER REFERENCES excel_imports(id) ON DELETE CASCADE,
            column_name    TEXT NOT NULL,
            display_name   TEXT,
            is_visible     INTEGER DEFAULT 1,
            is_filterable  INTEGER DEFAULT 0,
            display_order  INTEGER DEFAULT 0,
            is_primary     INTEGER DEFAULT 0,
            field_type     TEXT DEFAULT 'text',
            UNIQUE(import_id, column_name)
        );

        CREATE TABLE IF NOT EXISTS filter_options (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            import_id    INTEGER REFERENCES excel_imports(id) ON DELETE CASCADE,
            column_name  TEXT NOT NULL,
            value        TEXT NOT NULL,
            card_count   INTEGER DEFAULT 0,
            UNIQUE(import_id, column_name, value)
        );

        CREATE TABLE IF NOT EXISTS image_visibility_rules (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            import_id    INTEGER REFERENCES excel_imports(id) ON DELETE CASCADE,
            column_name  TEXT NOT NULL,
            value        TEXT NOT NULL,
            img_index    INTEGER NOT NULL DEFAULT -1,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS media_assets (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            original_filename TEXT NOT NULL,
            level1            TEXT NOT NULL DEFAULT '',
            level2            TEXT NOT NULL DEFAULT '',
            level3            TEXT NOT NULL DEFAULT '',
            description       TEXT DEFAULT '',
            file_path         TEXT NOT NULL UNIQUE,
            file_size         INTEGER DEFAULT 0,
            created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_media_lookup
            ON media_assets(level1, level2, level3);
        CREATE INDEX IF NOT EXISTS idx_media_l1 ON media_assets(level1);
        CREATE INDEX IF NOT EXISTS idx_media_l2 ON media_assets(level2);
        CREATE INDEX IF NOT EXISTS idx_media_l3 ON media_assets(level3);

        CREATE TABLE IF NOT EXISTS app_settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('default_img_index', '-1');
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('active_import_id', '');
    """)

    conn.commit()
    conn.close()
