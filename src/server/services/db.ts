import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

export interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface Task {
  id: string;
  user_id: string;
  prompt: string;
  status: string;
  is_active: boolean;
  last_execution: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const db = {
  // User operations
  async createUser(username: string, passwordHash: string): Promise<User> {
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
      [username, passwordHash]
    );
    return result.rows[0];
  },

  async getUserByUsername(username: string): Promise<User | null> {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] || null;
  },

  async many<T = any>(query: string, params?: any[]): Promise<T[]> {
    const result = await pool.query(query, params);
    return result.rows;
  },

  // Task operations
  async createTask(userId: string, prompt: string): Promise<Task> {
    const result = await pool.query(
      'INSERT INTO tasks (user_id, prompt, status, is_active) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, prompt, 'pending', true]
    );
    return result.rows[0];
  },

  async getTasksByUserId(userId: string): Promise<Task[]> {
    const result = await pool.query('SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return result.rows;
  },

  async updateTaskStatus(taskId: string, status: string): Promise<Task> {
    const result = await pool.query(
      'UPDATE tasks SET status = $1, last_execution = NOW() WHERE id = $2 RETURNING *',
      [status, taskId]
    );
    return result.rows[0];
  },

  async deactivateTask(taskId: string): Promise<Task> {
    const result = await pool.query(
      'UPDATE tasks SET is_active = false WHERE id = $1 RETURNING *',
      [taskId]
    );
    return result.rows[0];
  },

  async reactivateTask(taskId: string): Promise<Task> {
    const result = await pool.query(
      'UPDATE tasks SET is_active = true WHERE id = $1 RETURNING *',
      [taskId]
    );
    return result.rows[0];
  },

  async deleteTask(taskId: string): Promise<void> {
    await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
  },
}; 