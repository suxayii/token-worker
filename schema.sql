DROP TABLE IF EXISTS licenses;

CREATE TABLE licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    daily_count INTEGER DEFAULT 0,
    last_reset_date TEXT,
    activated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_licenses_uuid ON licenses(uuid);
