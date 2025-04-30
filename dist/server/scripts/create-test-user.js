"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function createTestUser() {
    try {
        const username = 'testuser';
        const email = 'testuser@example.com';
        const password = 'testpass123';
        const saltRounds = 10;
        const passwordHash = await bcrypt_1.default.hash(password, saltRounds);
        const user = await prisma.user.create({
            data: {
                username,
                email,
                password: passwordHash
            }
        });
        console.log('Test user created successfully:');
        console.log(`Username: ${username}`);
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log('You can now use these credentials to log in.');
    }
    catch (error) {
        console.error('Error creating test user:', error);
    }
    finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}
createTestUser();
