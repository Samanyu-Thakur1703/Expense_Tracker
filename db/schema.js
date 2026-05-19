const { createClient } = require('@libsql/client');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

let db;

function getDatabase() {
    if (db) return db;

    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (tursoUrl && tursoToken) {
        console.log('Connecting to Turso remote database...');
        db = createClient({ url: tursoUrl, authToken: tursoToken });
    } else {
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        const dbPath = path.join(dataDir, 'fintrack.db');
        console.log('Connecting to local SQLite:', dbPath);
        db = createClient({ url: 'file:' + dbPath });
    }

    return db;
}

async function initDatabase() {
    const database = getDatabase();

    await database.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            balance REAL DEFAULT 0,
            budget REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await database.execute(`
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await database.execute(`
        CREATE TABLE IF NOT EXISTS investments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            symbol TEXT NOT NULL,
            name TEXT NOT NULL,
            quantity REAL NOT NULL,
            buy_price REAL NOT NULL,
            current_price REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await database.execute(`
        CREATE TABLE IF NOT EXISTS otp_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            purpose TEXT DEFAULT 'login',
            expires_at DATETIME NOT NULL,
            used INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await database.execute('CREATE INDEX IF NOT EXISTS idx_otp_email_code ON otp_codes(email, code)');

    await database.execute(`
        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            provider TEXT NOT NULL,
            key TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await database.execute('CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date)');
    await database.execute('CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses(user_id, category)');
    await database.execute('CREATE INDEX IF NOT EXISTS idx_investments_user_symbol ON investments(user_id, symbol)');

    const existing = await database.execute({
        sql: 'SELECT id FROM users WHERE email = ?',
        args: ['demo@fintrack.com']
    });

    if (existing.rows.length === 0) {
        console.log('Seeding demo user...');
        const hash = bcrypt.hashSync('demo1234', 8);
        const insertResult = await database.execute({
            sql: 'INSERT INTO users (name, email, password_hash, balance, budget) VALUES (?, ?, ?, ?, ?)',
            args: ['Demo User', 'demo@fintrack.com', hash, 50000, 20000]
        });

        const userId = Number(insertResult.lastInsertRowid);

        const sampleExpenses = [
            { amount: 450, category: 'Food', description: 'Grocery shopping', date: '2026-05-12' },
            { amount: 1200, category: 'Bills', description: 'Electricity bill', date: '2026-05-13' },
            { amount: 800, category: 'Travel', description: 'Metro pass', date: '2026-05-14' },
            { amount: 2500, category: 'Shopping', description: 'New headphones', date: '2026-05-15' },
            { amount: 350, category: 'Food', description: 'Restaurant dinner', date: '2026-05-16' },
            { amount: 500, category: 'Health', description: 'Pharmacy', date: '2026-05-17' },
            { amount: 1500, category: 'Entertainment', description: 'Movie tickets + snacks', date: '2026-05-17' },
        ];

        for (const exp of sampleExpenses) {
            await database.execute({
                sql: 'INSERT INTO expenses (user_id, amount, category, description, date) VALUES (?, ?, ?, ?, ?)',
                args: [userId, exp.amount, exp.category, exp.description, exp.date]
            });
        }

        console.log('Demo user seeded with', sampleExpenses.length, 'sample expenses');
    }
}

module.exports = { getDatabase, initDatabase };
