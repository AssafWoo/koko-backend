"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const pg_1 = __importDefault(require("pg"));
const { Pool } = pg_1.default;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});
exports.db = {
    // User operations
    async createUser(username, passwordHash) {
        const result = await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *', [username, passwordHash]);
        return result.rows[0];
    },
    async getUserByUsername(username) {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        return result.rows[0] || null;
    },
    async many(query, params) {
        const result = await pool.query(query, params);
        return result.rows;
    },
    // Task operations
    async createTask(userId, prompt) {
        const result = await pool.query('INSERT INTO tasks (user_id, prompt, status, is_active) VALUES ($1, $2, $3, $4) RETURNING *', [userId, prompt, 'pending', true]);
        return result.rows[0];
    },
    async getTasksByUserId(userId) {
        const result = await pool.query('SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows;
    },
    async updateTaskStatus(taskId, status) {
        const result = await pool.query('UPDATE tasks SET status = $1, last_execution = NOW() WHERE id = $2 RETURNING *', [status, taskId]);
        return result.rows[0];
    },
    async deactivateTask(taskId) {
        const result = await pool.query('UPDATE tasks SET is_active = false WHERE id = $1 RETURNING *', [taskId]);
        return result.rows[0];
    },
    async reactivateTask(taskId) {
        const result = await pool.query('UPDATE tasks SET is_active = true WHERE id = $1 RETURNING *', [taskId]);
        return result.rows[0];
    },
    async deleteTask(taskId) {
        await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
    },
};
