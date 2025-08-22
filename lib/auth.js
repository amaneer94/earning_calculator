import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './db.js';

export async function createSession(userId) {
  const db = await getDatabase();
  const token = uuidv4();
  
  await db.run(
    'INSERT INTO sessions (token, user_id) VALUES (?, ?)',
    [token, userId]
  );
  
  return token;
}

export async function getSessionUser(token) {
  if (!token) return null;
  
  const db = await getDatabase();
  const session = await db.get(`
    SELECT u.id, u.username 
    FROM sessions s 
    JOIN users u ON s.user_id = u.id 
    WHERE s.token = ?
  `, [token]);
  
  return session;
}

export async function deleteSession(token) {
  const db = await getDatabase();
  await db.run('DELETE FROM sessions WHERE token = ?', [token]);
}

export async function verifyPassword(username, password) {
  const db = await getDatabase();
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
  
  if (!user) {
    return null;
  }
  
  const isValid = await bcrypt.compare(password, user.password);
  return isValid ? user : null;
}