"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const authenticateToken = async (req, res, next) => {
    try {
        console.log('Auth headers:', req.headers);
        const authHeader = req.headers['authorization'];
        const token = authHeader?.split(' ')[1] || req.query.token;
        if (!token) {
            console.log('No token provided');
            res.status(401).json({ message: 'No token provided' });
            return;
        }
        console.log('Received token:', token);
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        console.log('Decoded token:', decoded);
        // Verify user exists in database
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId }
        });
        console.log('Found user:', user);
        if (!user) {
            console.log('User not found in database');
            res.status(401).json({ message: 'User not found' });
            return;
        }
        // Attach user to request
        req.user = {
            id: user.id,
            username: user.username
        };
        console.log('Attached user to request:', req.user);
        next();
    }
    catch (error) {
        console.error('Auth error:', error);
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(403).json({ message: 'Invalid token' });
            return;
        }
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(403).json({ message: 'Token expired' });
            return;
        }
        res.status(500).json({ message: 'Authentication error' });
    }
};
exports.authenticateToken = authenticateToken;
