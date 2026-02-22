DROP TABLE IF EXISTS licenses;

CREATE TABLE licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    daily_count INTEGER DEFAULT 0,
    last_reset_date TEXT,
    activated_at INTEGER,
    max_daily_count INTEGER DEFAULT 50,
    term_ms INTEGER DEFAULT 31536000000
);

CREATE INDEX IF NOT EXISTS idx_licenses_uuid ON licenses(uuid);
