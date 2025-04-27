"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = __importDefault(require("pg"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function initDatabase() {
    // First, connect to the default postgres database
    const client = new pg_1.default.Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: 'postgres', // Connect to default database
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
    });
    try {
        await client.connect();
        // Create the database if it doesn't exist
        const dbName = process.env.DB_NAME || 'autotest';
        await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${dbName}'
      AND pid <> pg_backend_pid();
    `);
        await client.query(`DROP DATABASE IF EXISTS ${dbName};`);
        await client.query(`CREATE DATABASE ${dbName};`);
        console.log(`Database ${dbName} created successfully`);
        // Close the connection to postgres database
        await client.end();
        // Connect to our new database
        const dbClient = new pg_1.default.Client({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: dbName,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5432'),
        });
        await dbClient.connect();
        // Create tables
        await dbClient.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        prompt TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        is_active BOOLEAN DEFAULT true,
        last_execution TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('Tables created successfully');
        await dbClient.end();
    }
    catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}
initDatabase().catch(console.error);
