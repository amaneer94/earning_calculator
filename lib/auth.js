import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { openDb } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export async function createSession(userId) {
  const db = await openDb();
  const token = generateToken(userId);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  await db.run(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
    [token, userId, expiresAt.toISOString()]
  );
  
  return token;
}

export async function getSessionUser(token) {
  if (!token) return null;
  
  const db = await openDb();
  const session = await db.get(
    `SELECT s.*, u.id, u.username 
     FROM sessions s 
     JOIN users u ON s.user_id = u.id 
     WHERE s.token = ? AND s.expires_at > datetime('now')`,
    [token]
  );
  
  return session ? { id: session.user_id, username: session.username } : null;
}

export async function deleteSession(token) {
  const db = await openDb();
  await db.run('DELETE FROM sessions WHERE token = ?', [token]);
}

export async function authenticateUser(username, password) {
  const db = await openDb();
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
  
  if (!user) return null;
  
  const isValid = await verifyPassword(password, user.password);
  return isValid ? user : null;
}