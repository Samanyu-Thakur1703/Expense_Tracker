const express = require('express');
const router = express.Router();

// Fallback data used when Yahoo Finance is unavailable
const FALLBACK_STOCKS = [
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries', price: 2910.30, change: 1.15, changePercent: 0.04 },
    { symbol: 'TCS.NS', name: 'Tata Consultancy Services', price: 3982.10, change: -48.15, changePercent: -1.20 },
    { symbol: 'INFY.NS', name: 'Infosys Limited', price: 1515.45, change: 12.75, changePercent: 0.85 },
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', price: 1445.60, change: 6.48, changePercent: 0.45 }
];

const FALLBACK_MARKET = {
    nifty: { name: 'NIFTY 50', price: 22096.75, change: 99.44, changePercent: 0.45 },
    sensex: { name: 'SENSEX', price: 72831.20, change: 189.36, changePercent: 0.26 }
};

let yahooFinance = null;
try {
    yahooFinance = require('yahoo-finance2').default;
} catch (e) {
    console.warn('yahoo-finance2 not available, using fallback data');
}

const CACHE_TTL = 60000; // 1 minute cache
let cache = { stocks: null, market: null, stocksTime: 0, marketTime: 0 };

// Helper: map .BSE suffix to .NS for Yahoo Finance
function normalizeSymbol(sym) {
    return sym.replace('.BSE', '.NS');
}

// ─── GET /api/stocks/quotes?symbols=RELIANCE.NS,TCS.NS ───
router.get('/quotes', async (req, res) => {
    try {
        const symbols = (req.query.symbols || 'RELIANCE.NS,TCS.NS,INFY.NS,HDFCBANK.NS')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        if (!yahooFinance) {
            return res.json({ stocks: FALLBACK_STOCKS, source: 'fallback' });
        }

        const results = await Promise.allSettled(
            symbols.map(sym =>
                yahooFinance.quote(sym).catch(() =>
                    yahooFinance.quote(normalizeSymbol(sym))
                )
            )
        );

        const stocks = results.map((r, i) => {
            if (r.status === 'fulfilled' && r.value) {
                const q = r.value;
                return {
                    symbol: symbols[i],
                    name: q.shortName || q.longName || symbols[i],
                    price: q.regularMarketPrice || 0,
                    change: q.regularMarketChange || 0,
                    changePercent: q.regularMarketChangePercent || 0,
                    dayHigh: q.regularMarketDayHigh,
                    dayLow: q.regularMarketDayLow,
                    volume: q.regularMarketVolume,
                    marketCap: q.marketCap,
                    source: 'yahoo'
                };
            }
            // Fallback per stock
            const fb = FALLBACK_STOCKS.find(s => s.symbol === symbols[i]) ||
                       FALLBACK_STOCKS[i % FALLBACK_STOCKS.length];
            return { ...fb, symbol: symbols[i], source: 'fallback' };
        });

        cache.stocks = stocks;
        cache.stocksTime = Date.now();
        res.json({ stocks, source: 'yahoo' });
    } catch (err) {
        console.error('Stock quotes error:', err.message);
        res.json({ stocks: FALLBACK_STOCKS, source: 'fallback' });
    }
});

// ─── GET /api/stocks/quote?symbol=RELIANCE.NS ───
router.get('/quote', async (req, res) => {
    try {
        const symbol = req.query.symbol || 'RELIANCE.NS';

        if (!yahooFinance) {
            const fb = FALLBACK_STOCKS.find(s => s.symbol === symbol) || FALLBACK_STOCKS[0];
            return res.json({ stock: fb, source: 'fallback' });
        }

        const q = await yahooFinance.quote(symbol).catch(() =>
            yahooFinance.quote(normalizeSymbol(symbol))
        );

        if (!q || !q.regularMarketPrice) {
            const fb = FALLBACK_STOCKS.find(s => s.symbol === symbol) || FALLBACK_STOCKS[0];
            return res.json({ stock: fb, source: 'fallback' });
        }

        res.json({
            stock: {
                symbol,
                name: q.shortName || q.longName || symbol,
                price: q.regularMarketPrice,
                change: q.regularMarketChange,
                changePercent: q.regularMarketChangePercent,
                dayHigh: q.regularMarketDayHigh,
                dayLow: q.regularMarketDayLow,
                volume: q.regularMarketVolume,
                marketCap: q.marketCap
            },
            source: 'yahoo'
        });
    } catch (err) {
        console.error('Stock quote error:', err.message);
        const fb = FALLBACK_STOCKS.find(s => s.symbol === req.query.symbol) || FALLBACK_STOCKS[0];
        res.json({ stock: fb, source: 'fallback' });
    }
});

// ─── GET /api/stocks/market ───
router.get('/market', async (req, res) => {
    try {
        if (!yahooFinance) {
            return res.json({ market: FALLBACK_MARKET, source: 'fallback' });
        }

        const [niftyResult, sensexResult] = await Promise.allSettled([
            yahooFinance.quote('^NSEI'),
            yahooFinance.quote('^BSESN')
        ]);

        const market = {};

        if (niftyResult.status === 'fulfilled' && niftyResult.value?.regularMarketPrice) {
            const q = niftyResult.value;
            market.nifty = {
                name: 'NIFTY 50',
                price: q.regularMarketPrice,
                change: q.regularMarketChange || 0,
                changePercent: q.regularMarketChangePercent || 0,
                source: 'yahoo'
            };
        } else {
            market.nifty = FALLBACK_MARKET.nifty;
        }

        if (sensexResult.status === 'fulfilled' && sensexResult.value?.regularMarketPrice) {
            const q = sensexResult.value;
            market.sensex = {
                name: 'SENSEX',
                price: q.regularMarketPrice,
                change: q.regularMarketChange || 0,
                changePercent: q.regularMarketChangePercent || 0,
                source: 'yahoo'
            };
        } else {
            market.sensex = FALLBACK_MARKET.sensex;
        }

        cache.market = market;
        cache.marketTime = Date.now();
        res.json({ market, source: 'yahoo' });
    } catch (err) {
        console.error('Market data error:', err.message);
        res.json({ market: FALLBACK_MARKET, source: 'fallback' });
    }
});

module.exports = router;
