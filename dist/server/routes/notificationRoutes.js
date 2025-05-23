"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotificationToClients = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = require("@server/middleware/auth");
const router = express_1.default.Router();
// Store connected clients
const clients = new Set();
// Helper function to send notifications to all connected clients
const sendNotificationToClients = (message) => {
    clients.forEach(client => {
        try {
            client.write(`data: ${message}\n\n`);
        }
        catch (error) {
            console.error('Error sending notification to client:', error);
            clients.delete(client);
        }
    });
};
exports.sendNotificationToClients = sendNotificationToClients;
// SSE endpoint
const sseHandler = async (req, res, next) => {
    try {
        console.log('New SSE connection received');
        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        // Send initial connection message
        res.write(`data: ${JSON.stringify({ type: 'connection', message: 'Connected to SSE server' })}\n\n`);
        // Add client to the set
        clients.add(res);
        console.log(`Total connected clients: ${clients.size}`);
        // Handle client disconnect
        req.on('close', () => {
            console.log('Client disconnected');
            clients.delete(res);
            console.log(`Remaining connected clients: ${clients.size}`);
        });
        // Handle errors
        req.on('error', (error) => {
            console.error('SSE connection error:', error);
            clients.delete(res);
            console.log(`Remaining connected clients: ${clients.size}`);
        });
        // Send heartbeat every 30 seconds to keep connection alive
        const heartbeatInterval = setInterval(() => {
            try {
                const now = new Date();
                const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
                res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: localTime.toISOString() })}\n\n`);
            }
            catch (error) {
                console.error('Error sending heartbeat:', error);
                clearInterval(heartbeatInterval);
                clients.delete(res);
            }
        }, 30000);
        // Clean up on client disconnect
        req.on('close', () => {
            clearInterval(heartbeatInterval);
            clients.delete(res);
            console.log('Client disconnected and cleaned up');
        });
    }
    catch (error) {
        console.error('Error in SSE handler:', error);
        res.status(500).end();
    }
};
router.get('/', auth_1.authenticateToken, sseHandler);
exports.default = router;
