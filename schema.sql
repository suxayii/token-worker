-- 注意：删除了原有的 `DROP TABLE IF EXISTS` 防止手滑误删整个生产库

CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,      -- UNIQUE 约束在 SQLite 中会自动创建索引，无需在外部手动 CREATE INDEX
    daily_count INTEGER DEFAULT 0,
    last_reset_date TEXT,
    activated_at INTEGER,
    max_daily_count INTEGER DEFAULT 50,
    term_ms INTEGER DEFAULT 31536000000
);
