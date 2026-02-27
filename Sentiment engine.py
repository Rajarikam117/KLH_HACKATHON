"""
sentiment_engine.py
──────────────────────────────────────────────────────────────
Scrapes mock news headlines (BeautifulSoup) and scores them
using a keyword-weighted LLM-style pipeline.

In production: swap _fetch_headlines() to hit a real RSS/news
endpoint, and swap _llm_score() to call OpenAI / Gemini / etc.
"""

import re
import math
import random
from datetime import datetime
from bs4 import BeautifulSoup


# ─── Keyword Lexicon ──────────────────────────────────────────────────────────
# Each entry: (pattern, weight)   weight > 0 = bullish, < 0 = bearish

LEXICON = [
    # Strong bullish
    (r"\b(surge|soar|rally|boom|record high|52.week high|beats? estimates?|profit up|revenue grow)\b",  0.35),
    (r"\b(strong (earnings|results|quarter)|outperform|upgrade|buy rating|expansion|partnership)\b",    0.30),
    (r"\b(dividend|buyback|demerger|acqui|merger|new contract|order win)\b",                            0.20),
    # Mild bullish
    (r"\b(rise|gain|higher|positive|optimis|recovery|rebound|growth|increase)\b",                      0.15),
    (r"\b(stable|hold|maintain|steady|unchanged|neutral)\b",                                            0.05),
    # Mild bearish
    (r"\b(fall|decline|drop|slip|miss|below estimate|cut|reduce)\b",                                   -0.15),
    (r"\b(concern|risk|headwind|pressure|challeng|slowdown|weak)\b",                                   -0.20),
    # Strong bearish
    (r"\b(crash|collapse|plunge|loss|write.?off|fraud|scandal|lawsuit|default|bankrupt)\b",            -0.35),
    (r"\b(downgrade|sell rating|layoff|job cut|fine|penalty|probe|investigation)\b",                   -0.30),
]

# Stock-specific boosters  (symbol → extra weight if symbol appears in text)
STOCK_BOOST = {
    "TCS":      0.05,
    "INFY":     0.03,
    "RELIANCE": 0.04,
    "HDFCBANK": 0.03,
    "WIPRO":   -0.02,
    "ITC":      0.04,
}


# ─── Mock News Store (mimics scraped data) ────────────────────────────────────

MOCK_ARTICLES = {
    "TCS": [
        "TCS Q3 results beat estimates: net profit up 11% YoY, revenue surges",
        "Tata Consultancy Services wins $500M cloud contract from European bank",
        "TCS announces record high dividend, buyback program worth ₹17,000 crore",
        "TCS faces headwinds in BFSI vertical amid cautious client spending",
    ],
    "INFY": [
        "Infosys raises FY25 revenue guidance after strong Q3 performance",
        "Infosys signs partnership with SAP for AI-driven ERP solutions",
        "Infosys stock slips after CEO flags uncertain macro environment",
        "Infosys Q3: profit steady but misses street estimates marginally",
    ],
    "RELIANCE": [
        "Reliance Jio 5G expansion hits 200 new cities, subscriber growth soars",
        "Reliance Retail reports record quarterly revenue, margin expansion",
        "RIL new energy gigafactory on track, partnership with global OEM",
        "Reliance Industries Q3 PAT up 9%, beats consensus estimates",
    ],
    "HDFCBANK": [
        "HDFC Bank NIM stable as RBI holds repo rate unchanged",
        "HDFC Bank loan book grows 18% YoY, asset quality improves",
        "HDFC Bank deposit growth concerns linger despite strong profit",
        "HDFC Bank stock rises after management guides higher credit growth",
    ],
    "WIPRO": [
        "Wipro faces headwinds as key client reduces IT spending by 15%",
        "Wipro Q3 revenue declines 1.7% QoQ, weak BFSI outlook",
        "Wipro announces layoffs of 2,500 employees amid restructuring",
        "Wipro secures $200M deal but guidance disappoints street expectations",
    ],
    "ITC": [
        "ITC demerger of hotel business approved by board, stock hits 52-week high",
        "ITC cigarette volumes rise 6% despite tax increase, strong pricing power",
        "ITC FMCG segment posts 14% revenue growth, margin expansion continues",
        "ITC agribusiness exports surge on strong global commodity demand",
    ],
}


# ─── Scraper (BeautifulSoup) ──────────────────────────────────────────────────

def _fetch_headlines(symbol: str) -> list[str]:
    """
    In production: fetch from a real news RSS / web page.
    Here we simulate HTML scraping with BeautifulSoup on mock HTML.
    """
    articles = MOCK_ARTICLES.get(symbol, [])
    # Build fake HTML like a news aggregator would return
    html = "<html><body><ul class='news-list'>"
    for a in articles:
        html += f"<li class='news-item'><h3 class='headline'>{a}</h3></li>"
    html += "</ul></body></html>"

    soup      = BeautifulSoup(html, "html.parser")
    headlines = [tag.get_text(strip=True) for tag in soup.select(".headline")]
    return headlines


# ─── LLM-style Scorer ─────────────────────────────────────────────────────────

def _llm_score(text: str, symbol: str) -> float:
    """
    Keyword-weighted scoring — simulates an LLM sentiment call.
    Returns a float in [-1.0, +1.0].
    """
    text_lower = text.lower()
    raw_score  = 0.0

    for pattern, weight in LEXICON:
        matches = len(re.findall(pattern, text_lower, re.IGNORECASE))
        raw_score += matches * weight

    # Stock-specific boost
    if symbol.lower() in text_lower:
        raw_score += STOCK_BOOST.get(symbol, 0.0)

    # Add small noise (±0.05) to simulate LLM variance
    raw_score += random.uniform(-0.05, 0.05)

    # Clamp to [-1, 1] via tanh-like squash
    return round(math.tanh(raw_score), 3)


def _score_to_label(score: float) -> tuple[str, str, int]:
    """Returns (label, recommendation, confidence)."""
    abs_s = abs(score)
    confidence = min(99, int(50 + abs_s * 50 + random.uniform(-5, 5)))

    if score > 0.4:
        return "Positive", "BUY",  confidence
    elif score < -0.1:
        return "Negative", "SELL", confidence
    else:
        return "Neutral",  "HOLD", max(50, confidence - 10)


# ─── Public API ───────────────────────────────────────────────────────────────

def analyze_stock(symbol: str) -> dict:
    """
    Full pipeline: scrape → score → aggregate → return signal dict.
    """
    headlines = _fetch_headlines(symbol)
    if not headlines:
        return {
            "stock": symbol, "score": 0.0, "label": "Neutral",
            "confidence": 50, "recommendation": "HOLD",
            "headlines_analyzed": 0, "analyzed_at": datetime.now().isoformat(),
        }

    scores      = [_llm_score(h, symbol) for h in headlines]
    avg_score   = round(sum(scores) / len(scores), 3)
    label, rec, confidence = _score_to_label(avg_score)

    return {
        "stock":               symbol,
        "score":               avg_score,
        "label":               label,
        "confidence":          confidence,
        "recommendation":      rec,
        "headlines_analyzed":  len(headlines),
        "analyzed_at":         datetime.now().isoformat(),
    }


def analyze_all(symbols: list[str]) -> list[dict]:
    """Analyze a list of symbols and return sorted by score descending."""
    results = [analyze_stock(s) for s in symbols]
    results.sort(key=lambda x: x["score"], reverse=True)
    return results


# ─── Quick test ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    for r in analyze_all(["TCS", "INFY", "RELIANCE", "HDFCBANK", "WIPRO", "ITC"]):
        print(f"{r['stock']:12} score={r['score']:+.3f}  {r['label']:8}  {r['recommendation']}  conf={r['confidence']}%")
