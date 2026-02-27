# Novo Folio — Database Setup Guide

## Project Structure

```
novo-folio/
├── index.html           ← Frontend dashboard
├── styles.css           ← Styles
├── app.js               ← Frontend logic (USE_MOCK = false)
├── app.py               ← Flask backend API  ← NEW
├── database.py          ← SQLite schema + seed data  ← NEW
├── sentiment_engine.py  ← BeautifulSoup + LLM scorer  ← NEW
├── requirements.txt     ← Python dependencies  ← NEW
└── novofolio.db         ← SQLite database (auto-created on first run)
```

---

## Step 1 — Install Python dependencies

```bash
pip install -r requirements.txt
```

---

## Step 2 — Start the Flask backend

```bash
python app.py
```

You should see:
```
[DB] Database ready at /path/to/novofolio.db
=======================================================
  Novo Folio Backend — http://127.0.0.1:5000
=======================================================
```

The database (`novofolio.db`) is **auto-created** with seed data on first run.

---

## Step 3 — Open the dashboard

Open `index.html` in your browser. The frontend already has `USE_MOCK = false`
so it will talk to your Flask server at `http://127.0.0.1:5000`.

---

## API Endpoints

| Method | Endpoint         | Description                        |
|--------|------------------|------------------------------------|
| GET    | /health          | Health check                       |
| GET    | /portfolio       | Portfolio summary + holdings       |
| GET    | /sentiment       | Run fresh sentiment analysis       |
| GET    | /history         | Trade history (last 50)            |
| GET    | /chart           | Portfolio value snapshots          |
| GET    | /news            | Cached market news                 |
| POST   | /buy             | `{ "symbol": "TCS", "quantity": 5 }` |
| POST   | /sell            | `{ "symbol": "WIPRO", "quantity": 10 }` |
| POST   | /agent/cycle     | Run one autonomous agent cycle     |
| POST   | /prices/update   | Simulate live price tick           |

---

## Database Tables (SQLite)

| Table                | Purpose                              |
|----------------------|--------------------------------------|
| `portfolio`          | Cash balance and risk level          |
| `holdings`           | Stock positions (shares, avg price)  |
| `trades`             | Full buy/sell history                |
| `sentiment`          | Sentiment analysis history           |
| `news`               | Cached market news articles          |
| `portfolio_snapshots`| Daily value for performance chart    |

---

## Switching back to Mock Mode

In `app.js`, change line 4:
```js
const USE_MOCK = true;  // use mock data (no Flask needed)
```

---

## Connecting a Real LLM (Optional)

In `sentiment_engine.py`, replace `_llm_score()` with an OpenAI call:

```python
import openai

def _llm_score(text: str, symbol: str) -> float:
    client   = openai.OpenAI(api_key="YOUR_KEY")
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"Rate the sentiment of this headline for {symbol} stock from -1.0 (very negative) to +1.0 (very positive). Return ONLY a number.\n\n{text}"
        }]
    )
    return float(response.choices[0].message.content.strip())
```