"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../services/db");
const bcrypt_1 = __importDefault(require("bcrypt"));
async function createTestUser() {
    try {
        const username = 'testuser';
        const password = 'testpass123';
        const saltRounds = 10;
        const passwordHash = await bcrypt_1.default.hash(password, saltRounds);
        const user = await db_1.db.createUser(username, passwordHash);
        console.log('Test user created successfully:');
        console.log(`Username: ${username}`);
        console.log(`Password: ${password}`);
        console.log('You can now use these credentials to log in.');
    }
    catch (error) {
        console.error('Error creating test user:', error);
    }
    finally {
        process.exit(0);
    }
}
createTestUser();
