const express = require('express');
const { getDatabase } = require('../db/schema');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
    try {
        const db = getDatabase();
        const { category, search, start_date, end_date, type = 'all', limit = 100, offset = 0 } = req.query;

        let sql = 'SELECT id, amount, category, description, date, type, created_at FROM expenses WHERE user_id = ?';
        const args = [req.userId];

        if (category && category !== 'all') {
            sql += ' AND category = ?';
            args.push(category);
        }
        if (type && type !== 'all') {
            sql += ' AND type = ?';
            args.push(type);
        }
        if (search) {
            sql += ' AND (description LIKE ? OR category LIKE ?)';
            args.push(`%${search}%`, `%${search}%`);
        }
        if (start_date) {
            sql += ' AND date >= ?';
            args.push(start_date);
        }
        if (end_date) {
            sql += ' AND date <= ?';
            args.push(end_date);
        }

        sql += ' ORDER BY date DESC LIMIT ? OFFSET ?';
        args.push(parseInt(limit), parseInt(offset));

        const result = await db.execute({ sql, args });
        res.json({ expenses: result.rows });
    } catch (err) {
        console.error('Get expenses error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', authenticate, async (req, res) => {
    try {
        const { amount, category, description, date, type } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }
        if (!category) {
            return res.status(400).json({ error: 'Category is required' });
        }
        if (!description) {
            return res.status(400).json({ error: 'Description is required' });
        }
        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        const entryType = type === 'income' ? 'income' : 'expense';

        const db = getDatabase();
        const result = await db.execute({
            sql: 'INSERT INTO expenses (user_id, amount, category, description, date, type) VALUES (?, ?, ?, ?, ?, ?)',
            args: [req.userId, amount, category, description, date, entryType]
        });

        res.status(201).json({
            message: 'Expense created',
            expense: {
                id: Number(result.lastInsertRowid),
                amount,
                category,
                description,
                date,
                type: entryType
            }
        });
    } catch (err) {
        console.error('Create expense error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/expenses/export — CSV export (MUST be before /:id)
router.get('/export', authenticate, async (req, res) => {
    try {
        const db = getDatabase();
        const { start_date, end_date, category, type = 'all' } = req.query;

        let sql = 'SELECT date, type, category, description, amount FROM expenses WHERE user_id = ?';
        const args = [req.userId];

        if (start_date) {
            sql += ' AND date >= ?';
            args.push(start_date);
        }
        if (end_date) {
            sql += ' AND date <= ?';
            args.push(end_date);
        }
        if (category && category !== 'all') {
            sql += ' AND category = ?';
            args.push(category);
        }
        if (type && type !== 'all') {
            sql += ' AND type = ?';
            args.push(type);
        }

        sql += ' ORDER BY date DESC';

        const result = await db.execute({ sql, args });
        const rows = result.rows;

        let csv = 'Date,Type,Category,Description,Amount\n';
        for (const row of rows) {
            const desc = (row.description || '').replace(/"/g, '""');
            csv += `${row.date},${row.type},${row.category},"${desc}",${row.amount}\n`;
        }

        const filename = `fintrack-export-${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (err) {
        console.error('CSV export error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id', authenticate, async (req, res) => {
    try {
        const { amount, category, description, date, type } = req.body;
        const db = getDatabase();

        const existing = await db.execute({
            sql: 'SELECT id FROM expenses WHERE id = ? AND user_id = ?',
            args: [req.params.id, req.userId]
        });

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        const entryType = type === 'income' ? 'income' : 'expense';

        await db.execute({
            sql: 'UPDATE expenses SET amount = ?, category = ?, description = ?, date = ?, type = ? WHERE id = ? AND user_id = ?',
            args: [amount, category, description, date, entryType, req.params.id, req.userId]
        });

        res.json({
            message: 'Expense updated',
            expense: {
                id: parseInt(req.params.id),
                amount,
                category,
                description,
                date,
                type: entryType
            }
        });
    } catch (err) {
        console.error('Update expense error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.execute({
            sql: 'DELETE FROM expenses WHERE id = ? AND user_id = ?',
            args: [req.params.id, req.userId]
        });

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        res.json({ message: 'Expense deleted' });
    } catch (err) {
        console.error('Delete expense error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/stats', authenticate, async (req, res) => {
    try {
        const db = getDatabase();
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

        // Monthly expense total
        const monthlyResult = await db.execute({
            sql: "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND date >= ? AND type = 'expense'",
            args: [req.userId, monthStart]
        });

        // Monthly income total
        const monthlyIncomeResult = await db.execute({
            sql: "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND date >= ? AND type = 'income'",
            args: [req.userId, monthStart]
        });

        // All-time expense total
        const allTimeResult = await db.execute({
            sql: "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND type = 'expense'",
            args: [req.userId]
        });

        // All-time income total
        const allTimeIncomeResult = await db.execute({
            sql: "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND type = 'income'",
            args: [req.userId]
        });

        const categoryResult = await db.execute({
            sql: 'SELECT category, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE user_id = ? GROUP BY category ORDER BY total DESC',
            args: [req.userId]
        });

        const dailyResult = await db.execute({
            sql: "SELECT date, SUM(amount) as total FROM expenses WHERE user_id = ? AND date >= date('now', '-30 days') GROUP BY date ORDER BY date ASC",
            args: [req.userId]
        });

        const monthlyExpenses = monthlyResult.rows[0] ? monthlyResult.rows[0].total : 0;
        const monthlyIncome = monthlyIncomeResult.rows[0] ? monthlyIncomeResult.rows[0].total : 0;
        const allTimeExpenses = allTimeResult.rows[0] ? allTimeResult.rows[0].total : 0;
        const allTimeIncome = allTimeIncomeResult.rows[0] ? allTimeIncomeResult.rows[0].total : 0;

        res.json({
            monthly_total: monthlyExpenses,
            all_time_total: allTimeExpenses,
            income_total: monthlyIncome,
            net_cashflow: monthlyIncome - monthlyExpenses,
            income_all_time: allTimeIncome,
            cashflow_all_time: allTimeIncome - allTimeExpenses,
            category_breakdown: categoryResult.rows,
            daily_totals: dailyResult.rows
        });
    } catch (err) {
        console.error('Get stats error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
