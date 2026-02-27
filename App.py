"""
app.py — Flask Backend API for Novo Folio
══════════════════════════════════════════
Connects Database.py + Sentiment engine.py to
serve the frontend dashboard via REST endpoints.
"""

import importlib
import random
import math
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

# ─── Import project modules ──────────────────────────────
from Database import get_connection, init_db

# Handle space in filename for "Sentiment engine.py"
sentiment_engine = importlib.import_module("Sentiment engine")
analyze_all      = sentiment_engine.analyze_all
analyze_stock    = sentiment_engine.analyze_stock

# ─── App Setup ────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

SYMBOLS = ["TCS", "INFY", "RELIANCE", "HDFCBANK", "WIPRO", "ITC"]


# ═══════════════════════════════════════════════════════════
#  HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════

def _portfolio_summary():
    """Build the full portfolio JSON from the database."""
    conn = get_connection()

    # Portfolio cash & risk
    row = conn.execute("SELECT cash, risk_level FROM portfolio WHERE id=1").fetchone()
    cash = row["cash"]
    risk = row["risk_level"]

    # Holdings
    holdings = []
    total_value = cash
    total_pnl = 0

    for h in conn.execute("SELECT * FROM holdings ORDER BY symbol"):
        value = h["shares"] * h["current_price"]
        pnl   = (h["current_price"] - h["avg_price"]) * h["shares"]
        total_value += value
        total_pnl   += pnl
        holdings.append({
            "symbol":       h["symbol"],
            "company":      h["company"],
            "shares":       h["shares"],
            "avgPrice":     h["avg_price"],
            "currentPrice": h["current_price"],
            "sentiment":    h["sentiment"],
        })

    conn.close()
    return {
        "value":    round(total_value),
        "cash":     round(cash),
        "profit":   round(total_pnl),
        "risk":     risk,
        "holdings": holdings,
    }


def _update_risk(conn):
    """Recalculate and persist risk level based on P&L %."""
    port = conn.execute("SELECT cash FROM portfolio WHERE id=1").fetchone()
    cash = port["cash"]

    rows = conn.execute("SELECT shares, avg_price, current_price FROM holdings").fetchall()
    total_value = cash
    total_cost  = 0
    for r in rows:
        total_value += r["shares"] * r["current_price"]
        total_cost  += r["shares"] * r["avg_price"]

    pnl = total_value - total_cost - cash
    pnl_pct = (pnl / max(1, total_cost)) * 100

    if pnl_pct > 5:
        risk = "Low"
    elif pnl_pct > -2:
        risk = "Medium"
    else:
        risk = "High"

    conn.execute("UPDATE portfolio SET risk_level=?, updated_at=? WHERE id=1",
                 (risk, datetime.now().isoformat()))
    conn.commit()
    return risk


# ═══════════════════════════════════════════════════════════
#  API ENDPOINTS
# ═══════════════════════════════════════════════════════════

# ─── Health Check ──────────────────────────────────────────
@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "Novo Folio API", "timestamp": datetime.now().isoformat()})


# ─── Portfolio ─────────────────────────────────────────────
@app.route("/portfolio")
def portfolio():
    return jsonify(_portfolio_summary())


# ─── Sentiment Analysis ───────────────────────────────────
@app.route("/sentiment")
def sentiment():
    results = analyze_all(SYMBOLS)

    # Persist latest results
    conn = get_connection()
    for r in results:
        conn.execute(
            """INSERT INTO sentiment (stock, score, label, confidence, recommendation, analyzed_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (r["stock"], r["score"], r["label"], r["confidence"], r["recommendation"], r["analyzed_at"])
        )

        # Update holding sentiment label
        conn.execute("UPDATE holdings SET sentiment=? WHERE symbol=?", (r["label"], r["stock"]))

    conn.commit()
    conn.close()
    return jsonify(results)


# ─── Trade History ─────────────────────────────────────────
@app.route("/history")
def history():
    conn = get_connection()
    rows = conn.execute(
        "SELECT symbol AS stock, action, quantity, price, total, executed_at AS timestamp, source FROM trades ORDER BY executed_at DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ─── Chart Data (Portfolio Snapshots) ──────────────────────
@app.route("/chart")
def chart():
    conn = get_connection()
    rows = conn.execute(
        "SELECT snapped_at, value FROM portfolio_snapshots ORDER BY snapped_at ASC"
    ).fetchall()
    conn.close()

    labels = []
    values = []
    for r in rows:
        # Format date as "Feb 1" style
        try:
            dt = datetime.strptime(r["snapped_at"], "%Y-%m-%d")
            labels.append(dt.strftime("%b %d"))
        except ValueError:
            labels.append(r["snapped_at"])
        values.append(r["value"])

    return jsonify({"labels": labels, "values": values})


# ─── Market News ───────────────────────────────────────────
@app.route("/news")
def news():
    conn = get_connection()
    rows = conn.execute(
        "SELECT source, headline, description, sentiment, related_stock AS relatedStock, url, published_at FROM news ORDER BY published_at DESC LIMIT 5"
    ).fetchall()
    conn.close()

    news_list = []
    for r in rows:
        item = dict(r)
        # Calculate relative time
        try:
            pub = datetime.strptime(r["published_at"], "%Y-%m-%d %H:%M:%S")
            diff = datetime.now() - pub
            mins = int(diff.total_seconds() / 60)
            if mins < 60:
                item["time"] = f"{mins} min ago"
            elif mins < 1440:
                item["time"] = f"{mins // 60} hr ago"
            else:
                item["time"] = f"{mins // 1440} day ago"
        except (ValueError, TypeError):
            item["time"] = "recently"
        item["url"] = item.get("url") or "#"
        news_list.append(item)

    return jsonify(news_list)


# ─── BUY Stock ─────────────────────────────────────────────
@app.route("/buy", methods=["POST"])
def buy():
    data     = request.get_json()
    symbol   = data.get("symbol")
    quantity = data.get("quantity")

    if not symbol or not quantity or quantity < 1:
        return jsonify({"error": "Invalid symbol or quantity"}), 400

    conn = get_connection()
    holding = conn.execute("SELECT * FROM holdings WHERE symbol=?", (symbol,)).fetchone()
    if not holding:
        conn.close()
        return jsonify({"error": f"Stock {symbol} not found"}), 404

    port  = conn.execute("SELECT cash FROM portfolio WHERE id=1").fetchone()
    cash  = port["cash"]
    price = holding["current_price"]
    cost  = price * quantity

    if cost > cash:
        conn.close()
        return jsonify({"error": f"Insufficient cash. Need ₹{cost:,.0f}, have ₹{cash:,.0f}"}), 400

    # Update holding (recalculate avg price)
    old_total  = holding["avg_price"] * holding["shares"]
    new_shares = holding["shares"] + quantity
    new_avg    = round((old_total + cost) / new_shares, 2) if new_shares > 0 else 0

    conn.execute("UPDATE holdings SET shares=?, avg_price=?, updated_at=? WHERE symbol=?",
                 (new_shares, new_avg, datetime.now().isoformat(), symbol))

    # Deduct cash
    conn.execute("UPDATE portfolio SET cash=cash-?, updated_at=? WHERE id=1",
                 (cost, datetime.now().isoformat()))

    # Record trade
    conn.execute(
        "INSERT INTO trades (symbol, action, quantity, price, total, source, executed_at) VALUES (?,?,?,?,?,?,?)",
        (symbol, "BUY", quantity, price, cost, "MANUAL", datetime.now().strftime("%Y-%m-%d %H:%M"))
    )

    _update_risk(conn)
    conn.commit()
    conn.close()

    return jsonify({
        "message": f"BUY {quantity} × {symbol} @ ₹{price:,.2f}",
        "total": cost,
    })


# ─── SELL Stock ────────────────────────────────────────────
@app.route("/sell", methods=["POST"])
def sell():
    data     = request.get_json()
    symbol   = data.get("symbol")
    quantity = data.get("quantity")

    if not symbol or not quantity or quantity < 1:
        return jsonify({"error": "Invalid symbol or quantity"}), 400

    conn = get_connection()
    holding = conn.execute("SELECT * FROM holdings WHERE symbol=?", (symbol,)).fetchone()
    if not holding:
        conn.close()
        return jsonify({"error": f"Stock {symbol} not found"}), 404

    if quantity > holding["shares"]:
        conn.close()
        return jsonify({"error": f"Cannot sell {quantity} — you hold {holding['shares']} shares"}), 400

    price = holding["current_price"]
    total = price * quantity

    # Update holding
    conn.execute("UPDATE holdings SET shares=shares-?, updated_at=? WHERE symbol=?",
                 (quantity, datetime.now().isoformat(), symbol))

    # Add cash
    conn.execute("UPDATE portfolio SET cash=cash+?, updated_at=? WHERE id=1",
                 (total, datetime.now().isoformat()))

    # Record trade
    conn.execute(
        "INSERT INTO trades (symbol, action, quantity, price, total, source, executed_at) VALUES (?,?,?,?,?,?,?)",
        (symbol, "SELL", quantity, price, total, "MANUAL", datetime.now().strftime("%Y-%m-%d %H:%M"))
    )

    _update_risk(conn)
    conn.commit()
    conn.close()

    return jsonify({
        "message": f"SELL {quantity} × {symbol} @ ₹{price:,.2f}",
        "total": total,
    })


# ─── Autonomous Agent Cycle ────────────────────────────────
@app.route("/agent/cycle", methods=["POST"])
def agent_cycle():
    """
    One full agent cycle:
    1. Re-analyze sentiment for all stocks
    2. Based on score + confidence, auto-buy or sell
    3. Update risk level
    4. Return a log of actions taken
    """
    conn = get_connection()
    log  = []
    trades_executed = 0

    # Step 1: Fresh sentiment analysis
    signals = analyze_all(SYMBOLS)
    for s in signals:
        conn.execute(
            "INSERT INTO sentiment (stock, score, label, confidence, recommendation, analyzed_at) VALUES (?,?,?,?,?,?)",
            (s["stock"], s["score"], s["label"], s["confidence"], s["recommendation"], s["analyzed_at"])
        )
        conn.execute("UPDATE holdings SET sentiment=? WHERE symbol=?", (s["label"], s["stock"]))

    # Step 2: Execute trades based on sentiment
    port = conn.execute("SELECT cash FROM portfolio WHERE id=1").fetchone()
    cash = port["cash"]

    for signal in signals:
        holding = conn.execute("SELECT * FROM holdings WHERE symbol=?", (signal["stock"],)).fetchone()
        if not holding:
            continue

        log.append(f"Analyzing {signal['stock']}: Score={signal['score']}, Confidence={signal['confidence']}%, Rec={signal['recommendation']}")

        # BUY logic
        if signal["recommendation"] == "BUY" and signal["confidence"] >= 70 and signal["score"] > 0.5:
            qty  = max(1, signal["confidence"] // 30)
            cost = holding["current_price"] * qty

            if cost <= cash and cost <= cash * 0.15:
                old_total  = holding["avg_price"] * holding["shares"]
                new_shares = holding["shares"] + qty
                new_avg    = round((old_total + cost) / new_shares, 2)

                conn.execute("UPDATE holdings SET shares=?, avg_price=?, updated_at=? WHERE symbol=?",
                             (new_shares, new_avg, datetime.now().isoformat(), signal["stock"]))
                conn.execute("UPDATE portfolio SET cash=cash-? WHERE id=1", (cost,))
                conn.execute(
                    "INSERT INTO trades (symbol, action, quantity, price, total, source, executed_at) VALUES (?,?,?,?,?,?,?)",
                    (signal["stock"], "BUY", qty, holding["current_price"], cost, "AGENT", datetime.now().strftime("%Y-%m-%d %H:%M"))
                )
                cash -= cost
                trades_executed += 1
                log.append(f"AUTO-BUY: {qty} × {signal['stock']} @ ₹{holding['current_price']:,.2f} | Confidence: {signal['confidence']}%")
            else:
                log.append(f"Skipped BUY {signal['stock']} — insufficient cash or position limit")

        # SELL logic
        elif signal["recommendation"] == "SELL" and signal["confidence"] >= 65 and signal["score"] < -0.2:
            qty = max(1, min(holding["shares"] // 5, 5))
            if holding["shares"] >= qty:
                total = holding["current_price"] * qty
                conn.execute("UPDATE holdings SET shares=shares-? WHERE symbol=?", (qty, signal["stock"]))
                conn.execute("UPDATE portfolio SET cash=cash+? WHERE id=1", (total,))
                conn.execute(
                    "INSERT INTO trades (symbol, action, quantity, price, total, source, executed_at) VALUES (?,?,?,?,?,?,?)",
                    (signal["stock"], "SELL", qty, holding["current_price"], total, "AGENT", datetime.now().strftime("%Y-%m-%d %H:%M"))
                )
                cash += total
                trades_executed += 1
                log.append(f"AUTO-SELL: {qty} × {signal['stock']} @ ₹{holding['current_price']:,.2f} | Score: {signal['score']}")
            else:
                log.append(f"Skipped SELL {signal['stock']} — insufficient shares")

        elif signal["recommendation"] == "HOLD":
            log.append(f"Holding {signal['stock']} — sentiment neutral")

    # Step 3: Update risk
    risk = _update_risk(conn)

    # Step 4: Snapshot current portfolio value
    summary = _portfolio_summary()
    conn.execute("INSERT INTO portfolio_snapshots (value, snapped_at) VALUES (?, ?)",
                 (summary["value"], datetime.now().strftime("%Y-%m-%d")))

    conn.commit()
    conn.close()

    return jsonify({
        "trades_executed": trades_executed,
        "risk":            risk,
        "portfolio_value": summary["value"],
        "sentiment":       signals,
        "log":             log,
    })


# ─── Simulate Price Tick ───────────────────────────────────
@app.route("/prices/update", methods=["POST"])
def update_prices():
    """Simulate random price fluctuations (±0.3%)."""
    conn = get_connection()
    holdings = conn.execute("SELECT symbol, current_price FROM holdings").fetchall()

    updated = []
    for h in holdings:
        change = (random.random() - 0.48) * 0.006
        new_price = max(1, round(h["current_price"] * (1 + change), 2))
        conn.execute("UPDATE holdings SET current_price=?, updated_at=? WHERE symbol=?",
                     (new_price, datetime.now().isoformat(), h["symbol"]))
        updated.append({"symbol": h["symbol"], "price": new_price})

    _update_risk(conn)
    conn.commit()
    conn.close()

    return jsonify({"updated": updated})


# ═══════════════════════════════════════════════════════════
#  STARTUP
# ═══════════════════════════════════════════════════════════
if __name__ == "__main__":
    init_db()
    print("=" * 55)
    print("  Novo Folio Backend — http://127.0.0.1:5000")
    print("=" * 55)
    app.run(debug=True, port=5000)
