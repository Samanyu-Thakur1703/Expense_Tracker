const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'fintrack.db');

let db;

function getDatabase() {
    if (db) return db;

    const fs = require('fs');
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    createTables(db);
    createDefaultUser(db);

    return db;
}

function createTables(database) {
    database.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            balance REAL DEFAULT 0,
            budget REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

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
        );

        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            provider TEXT NOT NULL,
            key TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
        CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses(user_id, category);
        CREATE INDEX IF NOT EXISTS idx_investments_user_symbol ON investments(user_id, symbol);
    `);
}

function createDefaultUser(database) {
    const existing = database.prepare('SELECT id FROM users WHERE email = ?').get('demo@fintrack.com');
    if (!existing) {
        const hash = bcrypt.hashSync('demo1234', 8);
        const insertResult = database.prepare(
            'INSERT INTO users (name, email, password_hash, balance, budget) VALUES (?, ?, ?, ?, ?)'
        ).run('Demo User', 'demo@fintrack.com', hash, 50000, 20000);

        const userId = insertResult.lastInsertRowid;

        const sampleExpenses = [
            { amount: 450, category: 'Food', description: 'Grocery shopping', date: '2026-05-12' },
            { amount: 1200, category: 'Bills', description: 'Electricity bill', date: '2026-05-13' },
            { amount: 800, category: 'Travel', description: 'Metro pass', date: '2026-05-14' },
            { amount: 2500, category: 'Shopping', description: 'New headphones', date: '2026-05-15' },
            { amount: 350, category: 'Food', description: 'Restaurant dinner', date: '2026-05-16' },
            { amount: 500, category: 'Health', description: 'Pharmacy', date: '2026-05-17' },
            { amount: 1500, category: 'Entertainment', description: 'Movie tickets + snacks', date: '2026-05-17' },
        ];

        const insertExpense = database.prepare(
            'INSERT INTO expenses (user_id, amount, category, description, date) VALUES (?, ?, ?, ?, ?)'
        );
        const insertMany = database.transaction((expenses) => {
            for (const exp of expenses) {
                insertExpense.run(userId, exp.amount, exp.category, exp.description, exp.date);
            }
        });
        insertMany(sampleExpenses);
    }
}

module.exports = { getDatabase };
