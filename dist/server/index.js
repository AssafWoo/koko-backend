"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const tasks_1 = __importDefault(require("./routes/tasks"));
const auth_1 = __importDefault(require("./routes/auth"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const taskScheduler_1 = require("./services/taskScheduler");
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const port = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
}));
app.use(express_1.default.json());
// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    next();
});
// Routes
app.use('/api/tasks', tasks_1.default);
app.use('/api/auth', auth_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
// Start task scheduler
(0, taskScheduler_1.startTaskScheduler)();
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
        url: req.url,
        method: req.method,
        body: req.body,
        headers: req.headers
    });
    res.status(500).json({
        error: 'Something broke!',
        message: err.message,
        name: err.name
    });
});
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('CORS origin:', process.env.CORS_ORIGIN || 'http://localhost:5173');
});
// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    await prisma.$disconnect();
    process.exit(0);
});
