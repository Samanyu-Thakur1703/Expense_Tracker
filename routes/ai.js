const express = require('express');
const { getDatabase } = require('../db/schema');
const { authenticate } = require('../middleware/auth');
const Groq = require('groq-sdk');
const router = express.Router();

// ─── POST /api/ai/insights ───
// Generates financial insights based on user's expense data
router.post('/insights', authenticate, async (req, res) => {
    try {
        const db = getDatabase();
        const userId = req.userId;

        // Get all expenses for this user
        const { rows: expenses } = await db.execute({
            sql: 'SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC',
            args: [userId]
        });

        // Get user settings
        const { rows: users } = await db.execute({
            sql: 'SELECT balance, budget FROM users WHERE id = ?',
            args: [userId]
        });

        const user = users[0] || { balance: 0, budget: 0 };
        const balance = user.balance || 0;
        const budget = user.budget || 0;

        // Calculate stats
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let monthlyTotal = 0;
        let allTimeTotal = 0;
        const categoryTotals = {};
        const monthlyTotals = {};

        expenses.forEach(e => {
            const amt = parseFloat(e.amount) || 0;
            allTimeTotal += amt;
            const d = new Date(e.date);
            const cat = e.category || 'Others';

            categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;

            const monthKey = d.getFullYear() + '-' + (d.getMonth() + 1);
            monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + amt;

            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                monthlyTotal += amt;
            }
        });

        // Previous month total
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const prevMonthKey = prevYear + '-' + (prevMonth + 1);
        const prevMonthTotal = monthlyTotals[prevMonthKey] || 0;

        // Top category
        let topCategory = 'Others';
        let topAmount = 0;
        Object.keys(categoryTotals).forEach(cat => {
            if (categoryTotals[cat] > topAmount) {
                topAmount = categoryTotals[cat];
                topCategory = cat;
            }
        });

        // Category count
        const categoryCount = Object.keys(categoryTotals).length;

        // Generate insights
        const insights = [];

        // Budget alert
        if (budget > 0 && monthlyTotal > budget * 0.9) {
            insights.push({
                title: 'Budget Alert',
                desc: `You have used ${Math.round(monthlyTotal / budget * 100)}% of your monthly budget (₹${budget.toLocaleString('en-IN')}). Consider pausing non-essential spending.`,
                type: 'error',
                priority: 1
            });
        }

        // Spending pattern
        if (expenses.length > 0) {
            insights.push({
                title: 'Spending Pattern',
                desc: `Most of your transactions are in "${topCategory}" category (${Math.round(topAmount)} transactions). Consider diversifying your spending across categories.`,
                type: 'warning',
                priority: 2
            });
        }

        // Month-over-month comparison
        if (prevMonthTotal > 0) {
            const diff = monthlyTotal - prevMonthTotal;
            const diffPercent = Math.round((diff / prevMonthTotal) * 100);
            if (diff > 0) {
                insights.push({
                    title: 'Spending Trend',
                    desc: `Your spending increased by ${diffPercent}% compared to last month (₹${diff.toLocaleString('en-IN')}). Review your recent transactions to identify areas to cut back.`,
                    type: 'warning',
                    priority: 3
                });
            } else {
                insights.push({
                    title: 'Spending Trend',
                    desc: `Great job! Your spending decreased by ${Math.abs(diffPercent)}% compared to last month (₹${Math.abs(diff).toLocaleString('en-IN')} less). Keep it up!`,
                    type: 'info',
                    priority: 3
                });
            }
        }

        // Savings opportunity
        const budgetUsedPercent = budget > 0 ? (monthlyTotal / budget * 100) : 0;
        const remaining = budget - monthlyTotal;
        if (budget > 0 && budgetUsedPercent < 70) {
            insights.push({
                title: 'Savings Opportunity',
                desc: `You've only used ${Math.round(budgetUsedPercent)}% of your budget. You have ₹${remaining.toLocaleString('en-IN')} remaining this month. Consider investing the surplus in Index Funds for long-term growth.`,
                type: 'info',
                priority: 4
            });
        }

        // Category diversification
        if (categoryCount <= 2 && expenses.length >= 5) {
            insights.push({
                title: 'Diversification Tip',
                desc: `You're only spending in ${categoryCount} categories. Try exploring different areas to maintain a balanced financial portfolio.`,
                type: 'info',
                priority: 5
            });
        }

        // Daily average
        if (expenses.length > 0) {
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            const dailyAvg = monthlyTotal / daysInMonth;
            if (dailyAvg > 0) {
                insights.push({
                    title: 'Daily Spending',
                    desc: `Your daily average is ₹${dailyAvg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}. ${dailyAvg > 1000 ? 'Consider setting a daily spending limit to stay on track.' : 'You\'re maintaining a healthy daily spend rate.'}`,
                    type: 'info',
                    priority: 6
                });
            }
        }

        // Sort by priority
        insights.sort((a, b) => a.priority - b.priority);

        res.json({ insights, stats: { monthlyTotal, allTimeTotal, topCategory, budgetUsedPercent, categoryCount, dailyAvg: expenses.length > 0 ? monthlyTotal / new Date(currentYear, currentMonth + 1, 0).getDate() : 0 } });
    } catch (err) {
        console.error('AI insights error:', err.message);
        res.status(500).json({ error: 'Failed to generate insights' });
    }
});

// ─── POST /api/ai/chat ───
// Uses Groq (llama-3.3-70b) to answer financial questions with real user data context
const AI_MODEL = 'llama-3.3-70b-versatile';

router.post('/chat', authenticate, async (req, res) => {
    // Check if Groq API key is configured — do this OUTSIDE try so it never hits error handler
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.length < 8) {
        return res.json({
            response: "AI assistant is not configured. Please set your GROQ_API_KEY in the Vercel environment variables (get a free key at https://console.groq.com/keys).",
            mode: 'unconfigured'
        });
    }

    try {
        const { message, history } = req.body;
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }

        const db = getDatabase();
        const userId = req.userId;
        const question = message.trim();

        // Get basic user data
        const { rows: users } = await db.execute({
            sql: 'SELECT name, balance, budget FROM users WHERE id = ?',
            args: [userId]
        });

        if (!users[0]) {
            // User not found in DB (possible stale JWT or DB reset)
            // Use a generic system prompt without personal data — still answer the question
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
            const fallback = await groq.chat.completions.create({
                model: AI_MODEL,
                messages: [
                    { role: 'system', content: 'You are FinTrack AI, a helpful financial assistant. Answer user questions about personal finance, budgeting, saving, and investing in the Indian context (₹, PPF, NPS, Mutual Funds). Be concise and friendly.' },
                    { role: 'user', content: message }
                ]
            });
            return res.json({ response: fallback.choices[0].message.content, mode: 'ai' });
        }

        const user = users[0];
        const balance = parseFloat(user.balance) || 0;
        const budget = parseFloat(user.budget) || 0;

        // Get expenses
        const { rows: expenses } = await db.execute({
            sql: 'SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC LIMIT 500',
            args: [userId]
        });

        // Calculate financial stats for the system prompt
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let monthlyTotal = 0;
        let allTimeTotal = 0;
        const categoryTotals = {};

        expenses.forEach(e => {
            const amt = parseFloat(e.amount) || 0;
            allTimeTotal += amt;
            const cat = e.category || 'Others';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
            const d = new Date(e.date);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                monthlyTotal += amt;
            }
        });

        const topCategories = Object.keys(categoryTotals)
            .sort((a, b) => categoryTotals[b] - categoryTotals[a])
            .slice(0, 3);

        const budgetUsedPercent = budget > 0 ? Math.round(monthlyTotal / budget * 100) : 0;
        const remaining = budget - monthlyTotal;

        // Build system prompt with financial context
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const systemPrompt = `You are FinTrack AI, a helpful financial assistant for the FinTrack personal finance management app. You help users understand and manage their finances.

CURRENT USER DATA:
- Name: ${user.name}
- Current Balance: ₹${balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
- Monthly Budget: ₹${budget.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
- Total Expenses This Month: ₹${monthlyTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${budgetUsedPercent}% of budget used)
- Total Expenses All Time: ₹${allTimeTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
- Number of Expenses Tracked: ${expenses.length}
- Top Spending Categories: ${topCategories.length > 0 ? topCategories.map(c => `${c} (₹${categoryTotals[c].toLocaleString('en-IN')})`).join(', ') : 'None yet'}
- Remaining Budget This Month: ₹${Math.max(0, remaining).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
- Days in Current Month: ${daysInMonth}
- Current Date: ${now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

GUIDELINES:
1. Answer questions using the financial data provided above. Be specific with numbers.
2. Use Indian Rupee (₹) format for all monetary values with proper commas (e.g., ₹1,23,456.78).
3. Be concise, friendly, and conversational. Keep responses under 150 words unless detailed analysis is requested.
4. If asked about investments or stocks, provide general educational advice only. Always include a disclaimer that you are not a SEBI-registered advisor.
5. If asked about something outside your data scope, politely explain what you can help with.
6. Never make up fake transaction data. Only refer to the data provided.
7. For budget advice, use the 50/30/20 rule context: 50% needs, 30% wants, 20% savings.
8. The user is Indian (₹ currency) — tailor advice to Indian financial context (e.g., PPF, NPS, Mutual Funds for long-term).

CAPABILITIES:
- Check balance and net worth
- Analyze spending by category or time period
- Budget tracking and forecasts
- Savings tips and financial advice
- Investment education (general, not personalized)
- Spending pattern analysis`;

        // Initialize Groq
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        // Build OpenAI-format messages array
        const messages = [{ role: 'system', content: systemPrompt }];

        // Add conversation history (cap at 20 messages = 10 exchanges)
        if (history && Array.isArray(history)) {
            const recentHistory = history.slice(-20);
            recentHistory.forEach(h => {
                if (h.role && h.text) {
                    messages.push({
                        role: h.role === 'ai' ? 'assistant' : 'user',
                        content: h.text
                    });
                }
            });
        }

        // Add current user message
        messages.push({ role: 'user', content: question });

        // Call Groq (OpenAI-compatible chat completions API)
        const completion = await groq.chat.completions.create({
            model: AI_MODEL,
            messages
        });
        const response = completion.choices[0].message.content;

        res.json({ response, mode: 'ai' });
        } catch (err) {
        const msg = err.message || '';
        const statusCode = err.status || err.code || 0;
        const errType = err.constructor?.name || typeof err;
        console.error('AI chat error [' + statusCode + '][' + errType + ']:', msg);
        // Check by HTTP status code or known error patterns
        if (statusCode === 401 || statusCode === 403 ||
            msg.includes('401') || msg.includes('403') ||
            msg.includes('API_KEY') || msg.includes('API key') || msg.includes('not valid') ||
            msg.includes('permission') || msg.includes('unauthorized') ||
            msg.includes('denied') || msg.includes('auth')) {
            res.json({
                response: "The AI service is unavailable — the configured API key is invalid. Please update your GROQ_API_KEY in the Vercel environment variables with a valid key from https://console.groq.com/keys",
                mode: 'error'
            });
        } else if (statusCode === 429 || msg.includes('quota') || msg.includes('rate') || msg.includes('exhausted')) {
            res.json({
                response: "The AI service is currently rate-limited. Please wait a moment and try again.",
                mode: 'error'
            });
        } else if ((statusCode === 404 || statusCode === 400) && (msg.includes('model') || msg.includes('decommissioned') || msg.includes('deprecated'))) {
            res.json({
                response: "The AI model is unavailable — it may have been deprecated. Please contact support to update the model configuration.",
                mode: 'error'
            });
        } else if (msg.includes('SAFETY') || msg.includes('blocked') || msg.includes('finish_reason')) {
            res.json({
                response: "I couldn't respond to that due to content safety guidelines. Please rephrase your question.",
                mode: 'error'
            });
        } else {
            console.error('AI chat unhandled error:', JSON.stringify({ message: msg, code: err.code, status: err.status, type: errType }));
            res.json({
                response: "Sorry, the AI service is temporarily unavailable. Please try again in a moment.",
                mode: 'error'
            });
    }
}
});

module.exports = router;
