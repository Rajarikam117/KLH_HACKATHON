/* ═══════════════════════════════════════════
   Novo Folio — Sentiment Trading Dashboard
   app.js
   ═══════════════════════════════════════════ */

// ─── Configuration ────────────────────────────────────
const API_BASE = 'http://127.0.0.1:5000';
const USE_MOCK = true; // ← SET TO false WHEN FLASK BACKEND IS RUNNING
let agentEnabled = false;
let agentIntervalId = null;
const AGENT_CYCLE_INTERVAL = 10000; // 10 seconds

// ─── Mock Data ────────────────────────────────────────
const mockPortfolio = {
    value: 1052400,
    cash: 204500,
    profit: 52400,
    risk: 'Medium',
    holdings: [
        { symbol: 'TCS', company: 'Tata Consultancy Services', shares: 50, avgPrice: 3320, currentPrice: 3485, sentiment: 'Positive' },
        { symbol: 'INFY', company: 'Infosys Limited', shares: 80, avgPrice: 1420, currentPrice: 1395, sentiment: 'Neutral' },
        { symbol: 'RELIANCE', company: 'Reliance Industries', shares: 30, avgPrice: 2510, currentPrice: 2680, sentiment: 'Positive' },
        { symbol: 'HDFCBANK', company: 'HDFC Bank Limited', shares: 60, avgPrice: 1640, currentPrice: 1670, sentiment: 'Positive' },
        { symbol: 'WIPRO', company: 'Wipro Limited', shares: 100, avgPrice: 405, currentPrice: 392, sentiment: 'Negative' },
        { symbol: 'ITC', company: 'ITC Limited', shares: 200, avgPrice: 440, currentPrice: 462, sentiment: 'Positive' },
    ],
};

const mockSentiment = [
    { stock: 'TCS', score: 0.82, label: 'Positive', confidence: 91, recommendation: 'BUY' },
    { stock: 'INFY', score: 0.12, label: 'Neutral', confidence: 67, recommendation: 'HOLD' },
    { stock: 'RELIANCE', score: 0.75, label: 'Positive', confidence: 88, recommendation: 'BUY' },
    { stock: 'HDFCBANK', score: 0.45, label: 'Positive', confidence: 74, recommendation: 'BUY' },
    { stock: 'WIPRO', score: -0.38, label: 'Negative', confidence: 79, recommendation: 'SELL' },
    { stock: 'ITC', score: 0.55, label: 'Positive', confidence: 82, recommendation: 'BUY' },
];

const mockHistory = [
    { timestamp: '2026-02-27 15:30', stock: 'TCS', action: 'BUY', quantity: 10, price: 3450, total: 34500 },
    { timestamp: '2026-02-27 14:15', stock: 'WIPRO', action: 'SELL', quantity: 20, price: 398, total: 7960 },
    { timestamp: '2026-02-27 12:00', stock: 'RELIANCE', action: 'BUY', quantity: 5, price: 2650, total: 13250 },
    { timestamp: '2026-02-27 10:45', stock: 'INFY', action: 'BUY', quantity: 30, price: 1415, total: 42450 },
    { timestamp: '2026-02-26 15:00', stock: 'HDFCBANK', action: 'BUY', quantity: 15, price: 1635, total: 24525 },
    { timestamp: '2026-02-26 13:30', stock: 'ITC', action: 'BUY', quantity: 50, price: 438, total: 21900 },
    { timestamp: '2026-02-26 11:00', stock: 'TCS', action: 'SELL', quantity: 5, price: 3380, total: 16900 },
    { timestamp: '2026-02-25 14:20', stock: 'WIPRO', action: 'BUY', quantity: 40, price: 410, total: 16400 },
];

const mockChartData = {
    labels: ['Feb 1', 'Feb 3', 'Feb 5', 'Feb 7', 'Feb 9', 'Feb 11', 'Feb 13', 'Feb 15', 'Feb 17', 'Feb 19', 'Feb 21', 'Feb 23', 'Feb 25', 'Feb 27'],
    values: [980000, 988000, 975000, 995000, 1008000, 1002000, 1018000, 1025000, 1010000, 1030000, 1038000, 1042000, 1048000, 1052400],
};

const mockLogs = [
    { level: 'INFO', message: 'Dashboard initialized successfully' },
    { level: 'INFO', message: 'Fetching latest market data...' },
    { level: 'INFO', message: 'Sentiment analysis started for 6 stocks' },
    { level: 'INFO', message: 'Sentiment calculated for TCS — Score: 0.82' },
    { level: 'INFO', message: 'Sentiment calculated for INFY — Score: 0.12' },
    { level: 'ACTION', message: 'BUY signal generated for TCS (High confidence)' },
    { level: 'ACTION', message: 'BUY signal generated for RELIANCE (High confidence)' },
    { level: 'WARN', message: 'SELL signal generated for WIPRO (Negative sentiment)' },
    { level: 'INFO', message: 'Portfolio value updated: ₹10,52,400' },
    { level: 'INFO', message: 'Agent cycle complete — Next run in 60s' },
];

const mockNews = [
    {
        source: 'Economic Times', time: '12 min ago',
        headline: 'Sensex rallies 450 points as IT stocks surge on strong Q3 results',
        description: 'Indian benchmark indices ended higher led by gains in IT heavyweights TCS and Infosys after both reported better-than-expected quarterly earnings.',
        sentiment: 'Bullish', relatedStock: 'TCS', url: '#',
    },
    {
        source: 'Moneycontrol', time: '28 min ago',
        headline: 'RBI keeps repo rate unchanged at 6.5%, maintains accommodative stance',
        description: 'The Reserve Bank of India held the benchmark interest rate steady for the eighth consecutive meeting, citing persistent inflation concerns.',
        sentiment: 'Neutral', relatedStock: 'HDFCBANK', url: '#',
    },
    {
        source: 'LiveMint', time: '1 hr ago',
        headline: 'Reliance Jio announces 5G expansion to 200 more cities by March',
        description: "Reliance Industries' telecom arm plans aggressive 5G rollout, targeting nationwide coverage. Analysts see positive long-term impact on revenue.",
        sentiment: 'Bullish', relatedStock: 'RELIANCE', url: '#',
    },
    {
        source: 'Business Standard', time: '2 hr ago',
        headline: 'Wipro faces headwinds as key client reduces IT spending by 15%',
        description: 'Wipro shares fell 3% after reports that a major US-based client is cutting technology budgets amid economic uncertainty.',
        sentiment: 'Bearish', relatedStock: 'WIPRO', url: '#',
    },
    {
        source: 'CNBC TV18', time: '3 hr ago',
        headline: 'ITC to demerge hotel business; stock hits 52-week high',
        description: 'ITC Ltd shares surged to a new 52-week high after the company announced the demerger of its hotel business into a separate listed entity.',
        sentiment: 'Bullish', relatedStock: 'ITC', url: '#',
    },
];

// ─── Utility Functions ────────────────────────────────
const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 });
const fmtDecimal = (n) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const colors = {
        success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
        error: 'bg-red-500/15 border-red-500/30 text-red-400',
        info: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
    };
    const icons = { success: 'check-circle', error: 'x-circle', info: 'info' };
    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border ${colors[type]} text-sm font-medium shadow-xl toast-in`;
    toast.innerHTML = `<i data-lucide="${icons[type]}" class="w-4 h-4 flex-shrink-0"></i><span>${message}</span>`;
    container.appendChild(toast);
    lucide.createIcons({ attrs: { 'stroke-width': 2 }, nameAttr: 'data-lucide' });
    setTimeout(() => {
        toast.classList.replace('toast-in', 'toast-out');
        setTimeout(() => toast.remove(), 350);
    }, 3500);
}

function addLog(level, message) {
    const log = document.getElementById('activity-log');
    const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
    const levelColors = {
        INFO: 'text-blue-400',
        ACTION: 'text-emerald-400',
        WARN: 'text-amber-400',
        ERROR: 'text-red-400',
    };
    const el = document.createElement('div');
    el.className = 'flex gap-2';
    el.innerHTML = `
        <span class="text-slate-600 select-none">${time}</span>
        <span class="${levelColors[level] || 'text-slate-400'} font-semibold select-none">[${level}]</span>
        <span class="text-slate-300">${message}</span>
    `;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
}

function clearLogs() {
    document.getElementById('activity-log').innerHTML = '';
    addLog('INFO', 'Logs cleared');
}

// ─── 2. Portfolio Summary Cards ───────────────────────
function renderPortfolioCards(data) {
    const cards = [
        {
            icon: 'wallet', label: 'Total Portfolio Value', value: fmt(data.value),
            color: 'from-blue-500/20 to-blue-600/5', iconColor: 'text-blue-400', borderColor: 'border-blue-500/10',
        },
        {
            icon: 'banknote', label: 'Available Cash', value: fmt(data.cash),
            color: 'from-cyan-500/20 to-cyan-600/5', iconColor: 'text-cyan-400', borderColor: 'border-cyan-500/10',
        },
        {
            icon: 'trending-up', label: 'Total Profit / Loss',
            value: (data.profit >= 0 ? '+' : '') + fmt(data.profit),
            color: data.profit >= 0 ? 'from-emerald-500/20 to-emerald-600/5' : 'from-red-500/20 to-red-600/5',
            iconColor: data.profit >= 0 ? 'text-emerald-400' : 'text-red-400',
            borderColor: data.profit >= 0 ? 'border-emerald-500/10' : 'border-red-500/10',
            valueColor: data.profit >= 0 ? 'text-emerald-400' : 'text-red-400',
        },
        {
            icon: 'shield-alert', label: 'Risk Level', value: data.risk,
            color: data.risk === 'Low' ? 'from-emerald-500/20 to-emerald-600/5' : data.risk === 'Medium' ? 'from-amber-500/20 to-amber-600/5' : 'from-red-500/20 to-red-600/5',
            iconColor: data.risk === 'Low' ? 'text-emerald-400' : data.risk === 'Medium' ? 'text-amber-400' : 'text-red-400',
            borderColor: data.risk === 'Low' ? 'border-emerald-500/10' : data.risk === 'Medium' ? 'border-amber-500/10' : 'border-red-500/10',
            valueColor: data.risk === 'Low' ? 'text-emerald-400' : data.risk === 'Medium' ? 'text-amber-400' : 'text-red-400',
        },
    ];

    document.getElementById('portfolio-cards').innerHTML = cards.map(c => `
        <div class="bg-gradient-to-br ${c.color} bg-surface-800 rounded-2xl border ${c.borderColor} p-5 card-glow">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 rounded-xl bg-surface-700/80 flex items-center justify-center">
                    <i data-lucide="${c.icon}" class="w-5 h-5 ${c.iconColor}"></i>
                </div>
                <span class="text-xs font-medium text-slate-400 uppercase tracking-wide">${c.label}</span>
            </div>
            <p class="text-2xl font-bold ${c.valueColor || 'text-white'} tracking-tight">${c.value}</p>
        </div>
    `).join('');
    lucide.createIcons({ attrs: { 'stroke-width': 2 }, nameAttr: 'data-lucide' });
}

// ─── 3. Portfolio Holdings ────────────────────────────
function renderHoldings(holdings) {
    document.getElementById('holdings-count').textContent = `${holdings.length} stocks`;
    const sentimentStyle = {
        Positive: 'bg-emerald-500/15 text-emerald-400',
        Neutral: 'bg-slate-500/15 text-slate-400',
        Negative: 'bg-red-500/15 text-red-400',
    };

    document.getElementById('holdings-body').innerHTML = holdings.map(h => {
        const totalValue = h.shares * h.currentPrice;
        const pnl = (h.currentPrice - h.avgPrice) * h.shares;
        const pnlPct = ((h.currentPrice - h.avgPrice) / h.avgPrice * 100).toFixed(2);
        const pnlColor = pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
        return `
            <tr class="table-row-hover transition-colors">
                <td class="px-6 py-3 font-semibold text-white">${h.symbol}</td>
                <td class="px-4 py-3 text-slate-400">${h.company}</td>
                <td class="px-4 py-3 text-right text-white">${h.shares}</td>
                <td class="px-4 py-3 text-right text-slate-400">${fmtDecimal(h.avgPrice)}</td>
                <td class="px-4 py-3 text-right text-white font-medium">${fmtDecimal(h.currentPrice)}</td>
                <td class="px-4 py-3 text-right text-white">${fmt(totalValue)}</td>
                <td class="px-4 py-3 text-right ${pnlColor} font-medium">
                    ${pnl >= 0 ? '+' : ''}${fmt(pnl)} <span class="text-xs opacity-70">(${pnl >= 0 ? '+' : ''}${pnlPct}%)</span>
                </td>
                <td class="px-6 py-3 text-center">
                    <span class="inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${sentimentStyle[h.sentiment]}">${h.sentiment}</span>
                </td>
            </tr>
        `;
    }).join('');
}

// ─── 4. Sentiment Signals ─────────────────────────────
function renderSentiment(data) {
    const recStyles = {
        BUY: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
        SELL: 'bg-red-500/15 text-red-400 border-red-500/20',
        HOLD: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    };
    const labelStyle = {
        Positive: 'text-emerald-400',
        Neutral: 'text-slate-400',
        Negative: 'text-red-400',
    };

    document.getElementById('sentiment-body').innerHTML = data.map(s => `
        <tr class="table-row-hover transition-colors">
            <td class="px-6 py-3 font-semibold text-white">${s.stock}</td>
            <td class="px-4 py-3 text-right font-mono ${s.score >= 0 ? 'text-emerald-400' : 'text-red-400'}">${s.score >= 0 ? '+' : ''}${s.score.toFixed(2)}</td>
            <td class="px-4 py-3 text-center ${labelStyle[s.label]} font-medium">${s.label}</td>
            <td class="px-4 py-3 text-right text-white">
                <div class="flex items-center justify-end gap-2">
                    <div class="w-16 h-1.5 rounded-full bg-surface-600 overflow-hidden">
                        <div class="h-full rounded-full ${s.confidence >= 80 ? 'bg-emerald-400' : s.confidence >= 60 ? 'bg-amber-400' : 'bg-red-400'}" style="width:${s.confidence}%"></div>
                    </div>
                    <span class="text-xs font-medium">${s.confidence}%</span>
                </div>
            </td>
            <td class="px-6 py-3 text-center">
                <span class="inline-block px-3 py-1 rounded-lg text-xs font-bold border ${recStyles[s.recommendation]}">${s.recommendation}</span>
            </td>
        </tr>
    `).join('');
}

// ─── 6. Portfolio Performance Chart ───────────────────
let performanceChartInstance = null;

function renderChart(chartData) {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    if (performanceChartInstance) performanceChartInstance.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(59,130,246,0.25)');
    gradient.addColorStop(1, 'rgba(59,130,246,0)');

    performanceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Portfolio Value',
                data: chartData.values,
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 2.5,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#3b82f6',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
                fill: true,
                tension: 0.35,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a2035',
                    titleColor: '#94a3b8',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: false,
                    callbacks: { label: (ctx) => 'Value: ' + fmt(ctx.parsed.y) },
                },
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#475569', font: { size: 10 } },
                    border: { display: false },
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#475569', font: { size: 10 }, callback: (v) => '₹' + (v / 100000).toFixed(1) + 'L' },
                    border: { display: false },
                },
            },
        },
    });
}

function setChartRange(range) {
    document.querySelectorAll('.chart-range-btn').forEach(btn => {
        btn.classList.remove('bg-blue-500/15', 'text-blue-400');
        btn.classList.add('text-slate-400');
    });
    const active = document.querySelector(`.chart-range-btn[data-range="${range}"]`);
    active.classList.add('bg-blue-500/15', 'text-blue-400');
    active.classList.remove('text-slate-400');
    addLog('INFO', `Chart range updated to ${range}`);
}

// ─── 7. Trade History ─────────────────────────────────
function renderTradeHistory(history) {
    document.getElementById('history-body').innerHTML = history.map(t => {
        const actionStyle = t.action === 'BUY'
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-red-500/15 text-red-400';
        return `
            <tr class="table-row-hover transition-colors">
                <td class="px-6 py-3 text-slate-400 text-xs">${t.timestamp}</td>
                <td class="px-4 py-3 font-semibold text-white">${t.stock}</td>
                <td class="px-4 py-3 text-center">
                    <span class="inline-block px-2 py-0.5 rounded-md text-xs font-bold ${actionStyle}">${t.action}</span>
                </td>
                <td class="px-4 py-3 text-right text-white">${t.quantity}</td>
                <td class="px-4 py-3 text-right text-slate-300">${fmtDecimal(t.price)}</td>
                <td class="px-6 py-3 text-right text-white font-medium">${fmt(t.total)}</td>
            </tr>
        `;
    }).join('');
}

// ─── Live Chart Switching ─────────────────────────────
function switchLiveChart(symbol) {
    const container = document.getElementById('live-chart-container');
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'tradingview-widget-container';
    wrapper.style.cssText = 'height:100%;width:100%';
    const chartDiv = document.createElement('div');
    chartDiv.style.cssText = 'height:100%;width:100%';
    wrapper.appendChild(chartDiv);
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.textContent = JSON.stringify({
        autosize: true, symbol, interval: 'D', timezone: 'Asia/Kolkata',
        theme: 'dark', style: '1', locale: 'en',
        backgroundColor: 'rgba(17, 24, 39, 1)',
        gridColor: 'rgba(255, 255, 255, 0.03)',
        hide_top_toolbar: false, hide_legend: false,
        allow_symbol_change: true, save_image: false,
        calendar: false, hide_volume: false,
        support_host: 'https://www.tradingview.com',
    });
    wrapper.appendChild(script);
    container.appendChild(wrapper);
    addLog('INFO', `Live chart switched to ${symbol}`);
}

let chartVisible = true;
function toggleChart() {
    chartVisible = !chartVisible;
    const container = document.getElementById('live-chart-container');
    const toggle = document.getElementById('chart-toggle');
    const dot = document.getElementById('chart-toggle-dot');
    if (chartVisible) {
        container.style.height = '480px';
        container.style.overflow = '';
        toggle.classList.remove('bg-slate-600');
        toggle.classList.add('bg-emerald-500');
        dot.style.left = '20px';
        dot.classList.remove('bg-slate-400');
        dot.classList.add('bg-white');
    } else {
        container.style.height = '0';
        container.style.overflow = 'hidden';
        toggle.classList.remove('bg-emerald-500');
        toggle.classList.add('bg-slate-600');
        dot.style.left = '2px';
        dot.classList.remove('bg-white');
        dot.classList.add('bg-slate-400');
    }
}

// ─── 8. Activity Logs ─────────────────────────────────
function renderInitialLogs() {
    mockLogs.forEach(l => addLog(l.level, l.message));
}

// ─── 9. Market News ───────────────────────────────────
function renderNews(news) {
    const sentimentColors = {
        Bullish: 'bg-emerald-500/15 text-emerald-400',
        Bearish: 'bg-red-500/15 text-red-400',
        Neutral: 'bg-slate-500/15 text-slate-400',
    };
    document.getElementById('news-feed').innerHTML = news.slice(0, 5).map(n => `
        <a href="${n.url}" target="_blank" class="block px-6 py-4 hover:bg-surface-700/50 transition-colors group">
            <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1.5">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-blue-400">${n.source}</span>
                        <span class="text-[10px] text-slate-600">•</span>
                        <span class="text-[10px] text-slate-500">${n.time}</span>
                        <span class="text-[10px] text-slate-600">•</span>
                        <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${sentimentColors[n.sentiment]}">${n.sentiment}</span>
                    </div>
                    <h3 class="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors leading-snug mb-1">${n.headline}</h3>
                    <p class="text-xs text-slate-500 leading-relaxed line-clamp-2">${n.description}</p>
                </div>
                <div class="flex-shrink-0 mt-1">
                    <span class="inline-block px-2 py-1 rounded-md bg-surface-600 text-[10px] font-bold text-slate-300">${n.relatedStock}</span>
                </div>
            </div>
        </a>
    `).join('');
}

async function loadNews() {
    try {
        if (USE_MOCK) { renderNews(mockNews); return; }
        const res = await fetch(`${API_BASE}/news`);
        const data = await res.json();
        renderNews(data);
        addLog('INFO', 'Market news loaded from server');
    } catch (err) {
        addLog('ERROR', 'Failed to load news: ' + err.message);
        renderNews(mockNews);
    }
}

// ─── API Fetch Functions ──────────────────────────────
async function loadPortfolio() {
    try {
        if (USE_MOCK) {
            renderPortfolioCards(mockPortfolio);
            renderHoldings(mockPortfolio.holdings);
            return;
        }
        const res = await fetch(`${API_BASE}/portfolio`);
        const data = await res.json();
        renderPortfolioCards(data);
        renderHoldings(data.holdings);
        addLog('INFO', 'Portfolio data loaded from server');
    } catch (err) {
        addLog('ERROR', 'Failed to load portfolio: ' + err.message);
        renderPortfolioCards(mockPortfolio);
        renderHoldings(mockPortfolio.holdings);
    }
}

async function loadSentiment() {
    try {
        if (USE_MOCK) { renderSentiment(mockSentiment); return; }
        const res = await fetch(`${API_BASE}/sentiment`);
        const data = await res.json();
        renderSentiment(data);
        addLog('INFO', 'Sentiment data loaded from server');
    } catch (err) {
        addLog('ERROR', 'Failed to load sentiment: ' + err.message);
        renderSentiment(mockSentiment);
    }
}

async function loadTradeHistory() {
    try {
        if (USE_MOCK) { renderTradeHistory(mockHistory); return; }
        const res = await fetch(`${API_BASE}/history`);
        const data = await res.json();
        renderTradeHistory(data);
        addLog('INFO', 'Trade history loaded from server');
    } catch (err) {
        addLog('ERROR', 'Failed to load trade history: ' + err.message);
        renderTradeHistory(mockHistory);
    }
}

async function loadChart() {
    try {
        if (USE_MOCK) { renderChart(mockChartData); return; }
        const res = await fetch(`${API_BASE}/chart`);
        const data = await res.json();
        renderChart(data);
        addLog('INFO', 'Chart data loaded from server');
    } catch (err) {
        addLog('ERROR', 'Failed to load chart: ' + err.message);
        renderChart(mockChartData);
    }
}

// ─── Mock Trade Helper ─────────────────────────────────
function executeMockTrade(symbol, quantity, action) {
    const holding = mockPortfolio.holdings.find(h => h.symbol === symbol);
    if (!holding) return false;
    const price = holding.currentPrice;
    const cost = price * quantity;

    if (action === 'BUY') {
        if (cost > mockPortfolio.cash) {
            showToast(`Insufficient cash — need ${fmt(cost)}, have ${fmt(mockPortfolio.cash)}`, 'error');
            addLog('ERROR', `BUY rejected: insufficient cash for ${quantity} × ${symbol}`);
            return false;
        }
        const oldTotal = holding.avgPrice * holding.shares;
        holding.shares += quantity;
        holding.avgPrice = Math.round((oldTotal + cost) / holding.shares);
        mockPortfolio.cash -= cost;
    } else {
        if (quantity > holding.shares) {
            showToast(`Cannot sell ${quantity} shares — you only hold ${holding.shares}`, 'error');
            addLog('ERROR', `SELL rejected: only ${holding.shares} shares of ${symbol} held`);
            return false;
        }
        holding.shares -= quantity;
        mockPortfolio.cash += cost;
    }

    // Recalculate portfolio totals
    mockPortfolio.profit = mockPortfolio.holdings.reduce(
        (sum, h) => sum + (h.currentPrice - h.avgPrice) * h.shares, 0
    );

    // Add to trade history
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    mockHistory.unshift({ timestamp: ts, stock: symbol, action, quantity, price, total: cost });

    return true;
}

// ─── Re-render after trade ────────────────────────────
function renderAfterTrade() {
    renderPortfolioCards(mockPortfolio);
    renderHoldings(mockPortfolio.holdings);
    renderTradeHistory(mockHistory);
}

async function buyStock() {
    const symbol = document.getElementById('trade-symbol').value;
    const quantity = parseInt(document.getElementById('trade-qty').value);
    if (!quantity || quantity < 1) { showToast('Please enter a valid quantity', 'error'); return; }
    addLog('ACTION', `Executing BUY order: ${quantity} shares of ${symbol}`);
    try {
        if (USE_MOCK) {
            if (executeMockTrade(symbol, quantity, 'BUY')) {
                showToast(`BUY order placed — ${quantity} × ${symbol}`, 'success');
                addLog('INFO', `BUY order confirmed: ${quantity} × ${symbol} | Cash: ${fmt(mockPortfolio.cash)}`);
                renderAfterTrade();
            }
            return;
        }
        const res = await fetch(`${API_BASE}/buy`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol, quantity }),
        });
        const data = await res.json();
        if (res.ok) {
            showToast(`BUY order placed — ${quantity} × ${symbol}`, 'success');
            addLog('INFO', `BUY order confirmed: ${quantity} × ${symbol}`);
            refreshAll();
        } else {
            showToast(data.error || 'Buy failed', 'error');
            addLog('ERROR', data.error || 'Buy order failed');
        }
    } catch (err) {
        showToast('Network error — could not place order', 'error');
        addLog('ERROR', 'Buy failed: ' + err.message);
    }
}

async function sellStock() {
    const symbol = document.getElementById('trade-symbol').value;
    const quantity = parseInt(document.getElementById('trade-qty').value);
    if (!quantity || quantity < 1) { showToast('Please enter a valid quantity', 'error'); return; }
    addLog('ACTION', `Executing SELL order: ${quantity} shares of ${symbol}`);
    try {
        if (USE_MOCK) {
            if (executeMockTrade(symbol, quantity, 'SELL')) {
                showToast(`SELL order placed — ${quantity} × ${symbol}`, 'success');
                addLog('INFO', `SELL order confirmed: ${quantity} × ${symbol} | Cash: ${fmt(mockPortfolio.cash)}`);
                renderAfterTrade();
            }
            return;
        }
        const res = await fetch(`${API_BASE}/sell`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol, quantity }),
        });
        const data = await res.json();
        if (res.ok) {
            showToast(`SELL order placed — ${quantity} × ${symbol}`, 'success');
            addLog('INFO', `SELL order confirmed: ${quantity} × ${symbol}`);
            refreshAll();
        } else {
            showToast(data.error || 'Sell failed', 'error');
            addLog('ERROR', data.error || 'Sell order failed');
        }
    } catch (err) {
        showToast('Network error — could not place order', 'error');
        addLog('ERROR', 'Sell failed: ' + err.message);
    }
}

// ─── Refresh All Data ─────────────────────────────────
function refreshAll() {
    loadPortfolio();
    loadSentiment();
    loadTradeHistory();
    loadChart();
    loadNews();
}

// ─── Live Clock ───────────────────────────────────────
function updateClock() {
    document.getElementById('live-clock').textContent = new Date().toLocaleTimeString('en-IN', { hour12: false });
}

// ─── Update estimated trade price based on selection ──
function updateTradePrice() {
    const symbol = document.getElementById('trade-symbol').value;
    const stock = mockPortfolio.holdings.find(h => h.symbol === symbol);
    if (stock) document.getElementById('trade-price').textContent = fmtDecimal(stock.currentPrice);
}

// ─── Real-Time Price Simulation ───────────────────────
function simulateLivePrices() {
    if (!USE_MOCK) return;

    mockPortfolio.holdings.forEach(h => {
        const change = (Math.random() - 0.48) * 0.006; // slight upward bias
        h.currentPrice = Math.max(1, Math.round(h.currentPrice * (1 + change)));
    });

    let totalValue = mockPortfolio.cash;
    mockPortfolio.holdings.forEach(h => { totalValue += h.shares * h.currentPrice; });
    mockPortfolio.value = totalValue;
    mockPortfolio.profit = mockPortfolio.holdings.reduce((sum, h) => sum + (h.currentPrice - h.avgPrice) * h.shares, 0);

    const pnlPct = (mockPortfolio.profit / (totalValue - mockPortfolio.profit)) * 100;
    mockPortfolio.risk = pnlPct > 5 ? 'Low' : pnlPct > -2 ? 'Medium' : 'High';

    renderPortfolioCards(mockPortfolio);
    renderHoldings(mockPortfolio.holdings);
    updateTradePrice();
}

// ─── Initialize ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons({ attrs: { 'stroke-width': 2 }, nameAttr: 'data-lucide' });

    refreshAll();
    renderInitialLogs();

    updateClock();
    setInterval(updateClock, 1000);
    setInterval(simulateLivePrices, 2000);
    setInterval(loadNews, 5000);

    document.getElementById('trade-symbol').addEventListener('change', updateTradePrice);

    addLog('INFO', 'Novo Folio dashboard ready');
    addLog('INFO', 'Live price simulation started — prices update every 2s');
    addLog('INFO', 'Autonomous agent is PAUSED — toggle Auto-Trade to start');
});

// ─── Autonomous Trading Agent ─────────────────────────
function toggleAgent() {
    agentEnabled = !agentEnabled;
    const toggle = document.getElementById('agent-toggle');
    const dot = document.getElementById('agent-toggle-dot');
    const statusEl = document.getElementById('agent-status');

    if (agentEnabled) {
        toggle.classList.replace('bg-slate-600', 'bg-emerald-500');
        dot.classList.remove('left-0.5', 'bg-slate-400');
        dot.classList.add('left-[22px]', 'bg-white');
        statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 pulse-dot"></span><span class="text-emerald-400">Agent Trading</span>`;
        addLog('ACTION', '🤖 Autonomous trading agent ACTIVATED');
        addLog('INFO', 'Agent will analyze sentiment and execute trades every 10s');
        runAgentCycle();
        agentIntervalId = setInterval(runAgentCycle, AGENT_CYCLE_INTERVAL);
    } else {
        toggle.classList.replace('bg-emerald-500', 'bg-slate-600');
        dot.classList.remove('left-[22px]', 'bg-white');
        dot.classList.add('left-0.5', 'bg-slate-400');
        statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span><span class="text-amber-400">Agent Paused</span>`;
        addLog('WARN', '🤖 Autonomous trading agent PAUSED');
        if (agentIntervalId) { clearInterval(agentIntervalId); agentIntervalId = null; }
    }
    lucide.createIcons({ attrs: { 'stroke-width': 2 }, nameAttr: 'data-lucide' });
}

async function runAgentCycleAPI() {
    if (!agentEnabled) return;
    addLog('INFO', '─── Agent Cycle Start (Backend) ───');
    try {
        const res = await fetch(`${API_BASE}/agent/cycle`, { method: 'POST' });
        const data = await res.json();
        data.log.forEach(msg => addLog(msg.startsWith('AUTO') ? 'ACTION' : 'INFO', msg));
        if (data.trades_executed > 0) {
            showToast(`🤖 Agent executed ${data.trades_executed} trade(s)`, 'success');
            refreshAll();
        } else {
            addLog('INFO', 'No trades executed this cycle — conditions not met');
        }
        await fetch(`${API_BASE}/prices/update`, { method: 'POST' });
        addLog('INFO', `─── Agent Cycle End | Portfolio: ₹${Number(data.portfolio_value).toLocaleString('en-IN')} ───`);
    } catch (err) {
        addLog('ERROR', 'Agent cycle failed: ' + err.message);
    }
}

function runAgentCycle() {
    if (!agentEnabled) return;
    if (!USE_MOCK) { runAgentCycleAPI(); return; }
    addLog('INFO', '─── Agent Cycle Start ───');

    // Simulate sentiment score changes
    mockSentiment.forEach(s => {
        const drift = (Math.random() - 0.45) * 0.15;
        s.score = Math.max(-1, Math.min(1, +(s.score + drift).toFixed(2)));
        s.confidence = Math.max(50, Math.min(99, s.confidence + Math.floor((Math.random() - 0.5) * 8)));
        if (s.score > 0.4) { s.label = 'Positive'; s.recommendation = 'BUY'; }
        else if (s.score < -0.1) { s.label = 'Negative'; s.recommendation = 'SELL'; }
        else { s.label = 'Neutral'; s.recommendation = 'HOLD'; }
    });
    renderSentiment(mockSentiment);

    let tradesExecuted = 0;

    mockSentiment.forEach(signal => {
        const holding = mockPortfolio.holdings.find(h => h.symbol === signal.stock);
        if (!holding) return;
        addLog('INFO', `Analyzing ${signal.stock}: Score=${signal.score}, Confidence=${signal.confidence}%, Rec=${signal.recommendation}`);

        if (signal.recommendation === 'BUY' && signal.confidence >= 70 && signal.score > 0.5) {
            const qty = Math.max(1, Math.floor(signal.confidence / 30));
            const cost = holding.currentPrice * qty;
            if (cost <= mockPortfolio.cash && cost <= mockPortfolio.cash * 0.15) {
                if (executeMockTrade(signal.stock, qty, 'BUY')) {
                    addLog('ACTION', `🤖 AUTO-BUY: ${qty} × ${signal.stock} @ ${fmtDecimal(holding.currentPrice)} | Confidence: ${signal.confidence}%`);
                    tradesExecuted++;
                }
            } else {
                addLog('INFO', `Skipped BUY ${signal.stock} — insufficient cash or position limit`);
            }
        } else if (signal.recommendation === 'SELL' && signal.confidence >= 65 && signal.score < -0.2) {
            const qty = Math.max(1, Math.min(Math.floor(holding.shares * 0.2), 5));
            if (holding.shares >= qty) {
                if (executeMockTrade(signal.stock, qty, 'SELL')) {
                    addLog('ACTION', `🤖 AUTO-SELL: ${qty} × ${signal.stock} @ ${fmtDecimal(holding.currentPrice)} | Score: ${signal.score}`);
                    tradesExecuted++;
                }
            } else {
                addLog('INFO', `Skipped SELL ${signal.stock} — insufficient shares`);
            }
        } else if (signal.recommendation === 'HOLD') {
            addLog('INFO', `Holding ${signal.stock} — sentiment neutral`);
        }
    });

    if (tradesExecuted > 0) {
        renderAfterTrade();
        showToast(`🤖 Agent executed ${tradesExecuted} trade(s)`, 'success');
    } else {
        addLog('INFO', 'No trades executed this cycle — conditions not met');
    }

    const pnlPct = (mockPortfolio.profit / (mockPortfolio.value - mockPortfolio.profit)) * 100;
    mockPortfolio.risk = pnlPct > 5 ? 'Low' : pnlPct > -2 ? 'Medium' : 'High';
    renderPortfolioCards(mockPortfolio);

    addLog('INFO', `─── Agent Cycle End | Portfolio: ${fmt(mockPortfolio.value)} | P&L: ${fmt(mockPortfolio.profit)} | Risk: ${mockPortfolio.risk} ───`);
}


