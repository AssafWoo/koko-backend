import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
  one: (text: string, params?: any[]) => pool.query(text, params).then(res => res.rows[0]),
  oneOrNone: (text: string, params?: any[]) => pool.query(text, params).then(res => res.rows[0] || null),
  many: (text: string, params?: any[]) => pool.query(text, params).then(res => res.rows),
  manyOrNone: (text: string, params?: any[]) => pool.query(text, params).then(res => res.rows || []),
}; 