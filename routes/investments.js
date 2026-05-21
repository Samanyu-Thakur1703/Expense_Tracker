const express = require('express');
const { getDatabase } = require('../db/schema');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/investments — list user's investments
router.get('/', authenticate, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.execute({
            sql: 'SELECT id, symbol, name, quantity, buy_price, current_price, created_at FROM investments WHERE user_id = ? ORDER BY created_at DESC',
            args: [req.userId]
        });
        res.json({ investments: result.rows });
    } catch (err) {
        console.error('Get investments error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/investments/portfolio — portfolio summary
router.get('/portfolio', authenticate, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.execute({
            sql: 'SELECT symbol, name, quantity, buy_price, current_price FROM investments WHERE user_id = ?',
            args: [req.userId]
        });

        const holdings = result.rows;
        let totalInvested = 0;
        let currentValue = 0;

        const enrichedHoldings = holdings.map(h => {
            const invested = h.quantity * h.buy_price;
            const current = h.quantity * h.current_price;
            totalInvested += invested;
            currentValue += current;
            return {
                symbol: h.symbol,
                name: h.name,
                quantity: h.quantity,
                buy_price: h.buy_price,
                current_price: h.current_price,
                invested,
                current_value: current,
                return: current - invested,
                return_percent: invested > 0 ? ((current - invested) / invested * 100) : 0
            };
        });

        const totalReturn = currentValue - totalInvested;
        const returnPercent = totalInvested > 0 ? (totalReturn / totalInvested * 100) : 0;

        res.json({
            total_invested: totalInvested,
            current_value: currentValue,
            total_return: totalReturn,
            return_percent: returnPercent,
            holdings_count: holdings.length,
            holdings: enrichedHoldings
        });
    } catch (err) {
        console.error('Portfolio summary error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/investments — create investment
router.post('/', authenticate, async (req, res) => {
    try {
        const { symbol, name, quantity, buy_price, current_price } = req.body;

        if (!symbol || !name) {
            return res.status(400).json({ error: 'Symbol and name are required' });
        }
        if (!quantity || quantity <= 0) {
            return res.status(400).json({ error: 'Valid quantity is required' });
        }
        if (!buy_price || buy_price <= 0) {
            return res.status(400).json({ error: 'Valid buy price is required' });
        }
        if (!current_price || current_price <= 0) {
            return res.status(400).json({ error: 'Valid current price is required' });
        }

        const db = getDatabase();
        const result = await db.execute({
            sql: 'INSERT INTO investments (user_id, symbol, name, quantity, buy_price, current_price) VALUES (?, ?, ?, ?, ?, ?)',
            args: [req.userId, symbol, name, quantity, buy_price, current_price]
        });

        res.status(201).json({
            message: 'Investment created',
            investment: {
                id: Number(result.lastInsertRowid),
                symbol,
                name,
                quantity,
                buy_price,
                current_price
            }
        });
    } catch (err) {
        console.error('Create investment error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/investments/:id — update investment
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { symbol, name, quantity, buy_price, current_price } = req.body;
        const db = getDatabase();

        const existing = await db.execute({
            sql: 'SELECT id FROM investments WHERE id = ? AND user_id = ?',
            args: [req.params.id, req.userId]
        });

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Investment not found' });
        }

        await db.execute({
            sql: 'UPDATE investments SET symbol = ?, name = ?, quantity = ?, buy_price = ?, current_price = ? WHERE id = ? AND user_id = ?',
            args: [symbol, name, quantity, buy_price, current_price, req.params.id, req.userId]
        });

        res.json({
            message: 'Investment updated',
            investment: { id: parseInt(req.params.id), symbol, name, quantity, buy_price, current_price }
        });
    } catch (err) {
        console.error('Update investment error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/investments/:id — delete investment
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.execute({
            sql: 'DELETE FROM investments WHERE id = ? AND user_id = ?',
            args: [req.params.id, req.userId]
        });

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Investment not found' });
        }

        res.json({ message: 'Investment deleted' });
    } catch (err) {
        console.error('Delete investment error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
