"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Login endpoint
router.post('/login', (async (req, res, next) => {
    try {
        console.log('Login attempt - Request body:', req.body);
        const { username, password } = req.body;
        // Find user by username
        const user = await prisma.user.findUnique({
            where: { username }
        });
        console.log('Found user:', user);
        if (!user) {
            console.log('User not found:', username);
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        // Verify password
        const isValidPassword = await bcrypt_1.default.compare(password, user.password);
        console.log('Password valid:', isValidPassword);
        if (!isValidPassword) {
            console.log('Invalid password for user:', username);
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({
            userId: user.id.toString(),
            username: user.username
        }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
        console.log('Generated token for user:', { userId: user.id, username: user.username });
        res.json({ token });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// Token verification endpoint
router.post('/verify', (async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader?.split(' ')[1];
        if (!token) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        // Verify user still exists
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId }
        });
        if (!user) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        res.json({ valid: true, user: { id: user.id, username: user.username } });
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(403).json({ error: 'Invalid token' });
            return;
        }
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(403).json({ error: 'Token expired' });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// Logout endpoint
router.post('/logout', (req, res) => {
    // Since we're using JWT, we don't need to do anything on the server side
    // The client will remove the token from localStorage
    res.json({ message: 'Logged out successfully' });
});
exports.default = router;
