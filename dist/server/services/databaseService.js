"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
exports.readTasks = readTasks;
exports.writeTasks = writeTasks;
exports.addTaskLog = addTaskLog;
exports.updateTaskStatus = updateTaskStatus;
exports.getIntervalInMilliseconds = getIntervalInMilliseconds;
const database_1 = __importDefault(require("@server/config/database"));
// Initialize the database with required tables
async function initializeDatabase() {
    const client = await database_1.default.connect();
    try {
        await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        prompt TEXT,
        type VARCHAR(50),
        source VARCHAR(255),
        schedule JSONB,
        action VARCHAR(50),
        parameters JSONB,
        preview_result TEXT,
        delivery_method VARCHAR(50),
        description TEXT,
        status VARCHAR(50),
        last_execution TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS task_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID REFERENCES tasks(id),
        message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }
    finally {
        client.release();
    }
}
// Read all tasks
async function readTasks() {
    const result = await database_1.default.query(`
    SELECT 
      t.*,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'message', tl.message,
              'createdAt', tl.created_at
            )
          )
          FROM task_logs tl
          WHERE tl.task_id = t.id
        ),
        '[]'::json
      ) as logs
    FROM tasks t
    ORDER BY t.created_at DESC
  `);
    return result.rows.map(row => ({
        ...row,
        createdAt: row.created_at,
        lastExecution: row.last_execution,
        isActive: row.is_active,
        logs: row.logs
    }));
}
// Write tasks (for bulk updates)
async function writeTasks(tasks) {
    const client = await database_1.default.connect();
    try {
        await client.query('BEGIN');
        // Clear existing tasks
        await client.query('DELETE FROM tasks');
        // Insert new tasks
        for (const task of tasks) {
            await client.query(`
        INSERT INTO tasks (
          id, created_at, prompt, type, source, schedule, action,
          parameters, preview_result, delivery_method, description,
          status, last_execution, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
                task.id,
                task.createdAt,
                task.prompt,
                task.type,
                task.source,
                task.schedule,
                task.action,
                task.parameters,
                task.previewResult,
                task.deliveryMethod,
                task.description,
                task.status,
                task.lastExecution,
                task.isActive
            ]);
        }
        await client.query('COMMIT');
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
// Add a task log
async function addTaskLog(task, message) {
    await database_1.default.query(`
    INSERT INTO task_logs (task_id, message)
    VALUES ($1, $2)
  `, [task.id, message]);
}
// Update task status
async function updateTaskStatus(taskId, status) {
    await database_1.default.query(`
    UPDATE tasks
    SET status = $1, last_execution = CURRENT_TIMESTAMP
    WHERE id = $2
  `, [status, taskId]);
}
// Get interval in milliseconds
function getIntervalInMilliseconds(interval, unit) {
    switch (unit.toLowerCase()) {
        case 'minutes':
            return interval * 60 * 1000;
        case 'hours':
            return interval * 60 * 60 * 1000;
        case 'days':
            return interval * 24 * 60 * 60 * 1000;
        default:
            return interval * 1000;
    }
}
