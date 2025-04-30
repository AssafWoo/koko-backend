"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.refreshToken = exports.register = exports.login = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret-key';
const generateTokens = (userId, email) => {
    const accessToken = jsonwebtoken_1.default.sign({ userId, email }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jsonwebtoken_1.default.sign({ userId, email }, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                password: true,
                username: true
            }
        });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const isValidPassword = await bcrypt_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const { accessToken, refreshToken } = generateTokens(user.id, user.email);
        await prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });
        res.json({ accessToken, refreshToken });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.login = login;
const register = async (req, res) => {
    try {
        const { email, password, username, name } = req.body;
        const existingUser = await prisma.user.findUnique({
            where: { email },
            select: { id: true }
        });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                username,
                name
            },
            select: {
                id: true,
                email: true,
                username: true
            }
        });
        const { accessToken, refreshToken } = generateTokens(user.id, user.email);
        await prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        res.status(201).json({ accessToken, refreshToken });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.register = register;
const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true
                    }
                }
            },
        });
        if (!storedToken || storedToken.expiresAt < new Date()) {
            return res.status(403).json({ message: 'Invalid refresh token' });
        }
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(storedToken.user.id, storedToken.user.email);
        await prisma.refreshToken.update({
            where: { id: storedToken.id },
            data: {
                token: newRefreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        res.json({ accessToken, refreshToken: newRefreshToken });
    }
    catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.refreshToken = refreshToken;
const logout = async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            await prisma.refreshToken.deleteMany({
                where: { token },
            });
        }
        res.json({ message: 'Logged out successfully' });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.logout = logout;
