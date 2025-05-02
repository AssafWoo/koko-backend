import express, { RequestHandler } from 'express';
import { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '@server/middleware/auth';
import { notificationManager } from '@server/services/notificationManager';

const router = express.Router();

// SSE endpoint
const sseHandler: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  let heartbeatInterval: NodeJS.Timeout;
  
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

    // Add client to the notification manager
    notificationManager.addClient(res);
    console.log(`[SSE] Client added. Total clients: ${notificationManager.getClientCount()}`);

    // Handle client disconnect and cleanup
    const cleanup = () => {
      console.log('Client disconnected, cleaning up...');
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      notificationManager.removeClient(res);
      console.log(`[SSE] Client removed. Remaining clients: ${notificationManager.getClientCount()}`);
    };

    // Handle client disconnect
    req.on('close', cleanup);

    // Handle errors
    req.on('error', (error) => {
      console.error('SSE connection error:', error);
      cleanup();
    });

    // Send heartbeat every 30 seconds to keep connection alive
    heartbeatInterval = setInterval(() => {
      try {
        const now = new Date();
        const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
        res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: localTime.toISOString() })}\n\n`);
      } catch (error) {
        console.error('Error sending heartbeat:', error);
        cleanup();
      }
    }, 30000);

  } catch (error) {
    console.error('Error in SSE handler:', error);
    res.status(500).end();
  }
};

router.get('/', authenticateToken, sseHandler);

export default router; 