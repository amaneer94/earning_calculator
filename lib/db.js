import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

let db = null;

export async function getDatabase() {
  if (db) {
    return db;
  }

  const dbPath = path.join(process.cwd(), 'earnings.db');
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Initialize database tables
  await initializeTables();
  
  return db;
}

async function initializeTables() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      report_date TEXT NOT NULL,
      global_tax_rate REAL DEFAULT 1.0,
      default_payoneer_fee REAL DEFAULT 2.0,
      financial_metrics TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS report_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_date TEXT NOT NULL,
      gross_amount REAL NOT NULL,
      misc_fee REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      payoneer_fee REAL DEFAULT 0,
      conversion_rate REAL DEFAULT 0,
      fiverr_fee REAL DEFAULT 0,
      remaining_usd REAL DEFAULT 0,
      converted REAL DEFAULT 0,
      net REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      final_amount REAL DEFAULT 0,
      receivable REAL DEFAULT 0,
      percent_of_gross REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_report_sources_report_id ON report_sources(report_id);
  `);

  // Create default admin user if it doesn't exist
  const adminUser = await db.get('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!adminUser) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('password', 10);
    await db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
  }
}