"""
database.py — SQLite schema + seed data for Novo Folio
"""

import sqlite3
import os
from datetime import datetime, timedelta
import random

DB_PATH = os.path.join(os.path.dirname(__file__), "novofolio.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row          # dict-like rows
    conn.execute("PRAGMA journal_mode=WAL")  # better concurrent reads
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# ─── Schema ───────────────────────────────────────────────────────────────────

SCHEMA = """
-- Portfolio cash & metadata
CREATE TABLE IF NOT EXISTS portfolio (
    id          INTEGER PRIMARY KEY,
    cash        REAL    NOT NULL DEFAULT 200000.0,
    risk_level  TEXT    NOT NULL DEFAULT 'Medium',
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Holdings: one row per stock
CREATE TABLE IF NOT EXISTS holdings (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol         TEXT    NOT NULL UNIQUE,
    company        TEXT    NOT NULL,
    shares         INTEGER NOT NULL DEFAULT 0,
    avg_price      REAL    NOT NULL DEFAULT 0.0,
    current_price  REAL    NOT NULL DEFAULT 0.0,
    sentiment      TEXT    NOT NULL DEFAULT 'Neutral',
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Every buy/sell trade
CREATE TABLE IF NOT EXISTS trades (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT    NOT NULL,
    action      TEXT    NOT NULL CHECK(action IN ('BUY','SELL')),
    quantity    INTEGER NOT NULL,
    price       REAL    NOT NULL,
    total       REAL    NOT NULL,
    source      TEXT    NOT NULL DEFAULT 'MANUAL',  -- MANUAL | AGENT
    executed_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Sentiment analysis history
CREATE TABLE IF NOT EXISTS sentiment (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    stock          TEXT    NOT NULL,
    score          REAL    NOT NULL,
    label          TEXT    NOT NULL,
    confidence     INTEGER NOT NULL,
    recommendation TEXT    NOT NULL,
    source         TEXT    NOT NULL DEFAULT 'LLM',
    analyzed_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Market news cache
CREATE TABLE IF NOT EXISTS news (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    source       TEXT NOT NULL,
    headline     TEXT NOT NULL,
    description  TEXT,
    sentiment    TEXT NOT NULL DEFAULT 'Neutral',
    related_stock TEXT,
    url          TEXT,
    published_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Portfolio value snapshots for the performance chart
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    value       REAL NOT NULL,
    snapped_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


# ─── Seed Data ────────────────────────────────────────────────────────────────

SEED_HOLDINGS = [
    ("TCS",      "Tata Consultancy Services", 50,  3320, 3485, "Positive"),
    ("INFY",     "Infosys Limited",           80,  1420, 1395, "Neutral"),
    ("RELIANCE", "Reliance Industries",       30,  2510, 2680, "Positive"),
    ("HDFCBANK", "HDFC Bank Limited",         60,  1640, 1670, "Positive"),
    ("WIPRO",    "Wipro Limited",             100, 405,  392,  "Negative"),
    ("ITC",      "ITC Limited",               200, 440,  462,  "Positive"),
]

SEED_SENTIMENT = [
    ("TCS",      0.82,  "Positive", 91, "BUY"),
    ("INFY",     0.12,  "Neutral",  67, "HOLD"),
    ("RELIANCE", 0.75,  "Positive", 88, "BUY"),
    ("HDFCBANK", 0.45,  "Positive", 74, "BUY"),
    ("WIPRO",   -0.38,  "Negative", 79, "SELL"),
    ("ITC",      0.55,  "Positive", 82, "BUY"),
]

SEED_NEWS = [
    ("Economic Times",    "Sensex rallies 450 points as IT stocks surge on strong Q3 results",
     "Indian benchmark indices ended higher led by gains in IT heavyweights TCS and Infosys.", "Bullish", "TCS"),
    ("Moneycontrol",      "RBI keeps repo rate unchanged at 6.5%, maintains accommodative stance",
     "The Reserve Bank of India held the benchmark interest rate steady for the eighth consecutive meeting.", "Neutral", "HDFCBANK"),
    ("LiveMint",          "Reliance Jio announces 5G expansion to 200 more cities by March",
     "Reliance Industries' telecom arm plans aggressive 5G rollout targeting nationwide coverage.", "Bullish", "RELIANCE"),
    ("Business Standard", "Wipro faces headwinds as key client reduces IT spending by 15%",
     "Wipro shares fell 3% after reports that a major US-based client is cutting technology budgets.", "Bearish", "WIPRO"),
    ("CNBC TV18",         "ITC to demerge hotel business; stock hits 52-week high",
     "ITC Ltd shares surged to a new 52-week high after the company announced the demerger of its hotel business.", "Bullish", "ITC"),
]

SEED_TRADES = [
    ("TCS",      "BUY",  10, 3450, 34500),
    ("WIPRO",    "SELL", 20, 398,  7960),
    ("RELIANCE", "BUY",  5,  2650, 13250),
    ("INFY",     "BUY",  30, 1415, 42450),
    ("HDFCBANK", "BUY",  15, 1635, 24525),
    ("ITC",      "BUY",  50, 438,  21900),
    ("TCS",      "SELL", 5,  3380, 16900),
    ("WIPRO",    "BUY",  40, 410,  16400),
]


def init_db():
    """Create tables and seed with initial data if empty."""
    conn = get_connection()
    conn.executescript(SCHEMA)
    conn.commit()

    cur = conn.cursor()

    # Portfolio row
    cur.execute("SELECT COUNT(*) FROM portfolio")
    if cur.fetchone()[0] == 0:
        cur.execute("INSERT INTO portfolio (cash, risk_level) VALUES (?, ?)", (204500.0, "Medium"))

    # Holdings
    cur.execute("SELECT COUNT(*) FROM holdings")
    if cur.fetchone()[0] == 0:
        cur.executemany(
            "INSERT INTO holdings (symbol, company, shares, avg_price, current_price, sentiment) VALUES (?,?,?,?,?,?)",
            SEED_HOLDINGS
        )

    # Latest sentiment
    cur.execute("SELECT COUNT(*) FROM sentiment")
    if cur.fetchone()[0] == 0:
        cur.executemany(
            "INSERT INTO sentiment (stock, score, label, confidence, recommendation) VALUES (?,?,?,?,?)",
            SEED_SENTIMENT
        )

    # News
    cur.execute("SELECT COUNT(*) FROM news")
    if cur.fetchone()[0] == 0:
        cur.executemany(
            "INSERT INTO news (source, headline, description, sentiment, related_stock) VALUES (?,?,?,?,?)",
            SEED_NEWS
        )

    # Trades
    cur.execute("SELECT COUNT(*) FROM trades")
    if cur.fetchone()[0] == 0:
        base = datetime.now() - timedelta(days=3)
        for i, (sym, act, qty, price, total) in enumerate(SEED_TRADES):
            ts = (base + timedelta(hours=i * 5)).strftime("%Y-%m-%d %H:%M")
            cur.execute(
                "INSERT INTO trades (symbol, action, quantity, price, total, executed_at) VALUES (?,?,?,?,?,?)",
                (sym, act, qty, price, total, ts)
            )

    # Portfolio snapshots for chart (last 30 days)
    cur.execute("SELECT COUNT(*) FROM portfolio_snapshots")
    if cur.fetchone()[0] == 0:
        base_val = 980000
        for i in range(30):
            day   = (datetime.now() - timedelta(days=29 - i)).strftime("%Y-%m-%d")
            drift = random.uniform(-0.008, 0.012)
            base_val = round(base_val * (1 + drift))
            cur.execute(
                "INSERT INTO portfolio_snapshots (value, snapped_at) VALUES (?, ?)",
                (base_val, day)
            )

    conn.commit()
    conn.close()
    print(f"[DB] Database ready at {DB_PATH}")


if __name__ == "__main__":
    init_db()


