import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

let db = null;

export async function openDb() {
  if (!db) {
    db = await open({
      filename: path.join(process.cwd(), 'database.sqlite'),
      driver: sqlite3.Database,
    });
    
    await initializeDb();
  }
  return db;
}

async function initializeDb() {
  // Create users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create reports table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      report_date DATE NOT NULL,
      global_tax_rate REAL DEFAULT 1.00,
      default_payoneer_fee REAL DEFAULT 2.00,
      total_gross REAL DEFAULT 0,
      total_misc_fee REAL DEFAULT 0,
      total_tax REAL DEFAULT 0,
      total_net REAL DEFAULT 0,
      subtotal_receivable REAL DEFAULT 0,
      global_tax_amount REAL DEFAULT 0,
      grand_total_receivable REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Create report_sources table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS report_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_date DATE NOT NULL,
      gross_amount REAL NOT NULL,
      fiverr_fee REAL DEFAULT 0,
      payoneer_fee REAL DEFAULT 0,
      conversion_rate REAL DEFAULT 0,
      misc_fee REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      net REAL DEFAULT 0,
      receivable REAL DEFAULT 0,
      percent_of_gross REAL DEFAULT 0,
      gross_in_pkr REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports (id) ON DELETE CASCADE
    )
  `);

  // Create sessions table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Create default admin user if it doesn't exist
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash('password', 10);
  
  await db.run(`
    INSERT OR IGNORE INTO users (username, password) 
    VALUES (?, ?)
  `, ['admin', hashedPassword]);
}

export { db };