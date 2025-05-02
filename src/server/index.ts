import express from 'express';
import cors from 'cors';
import taskRoutes from './routes/tasks';
import authRoutes from './routes/auth';
import notificationRoutes from './routes/notificationRoutes';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { TaskScheduler } from './scheduler/TaskScheduler';
import { TaskRepository } from './repository/TaskRepository';
import { NotificationService } from './notifications/NotificationService';
import { ContentGenerationService } from './content/ContentGenerationService';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  next();
});

// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);

// Initialize services
const taskRepository = new TaskRepository(prisma);
const taskScheduler = new TaskScheduler(taskRepository);
const notificationService = new NotificationService(prisma);
const contentGenerationService = new ContentGenerationService(prisma);

// Start the task scheduler
taskScheduler.start().catch(error => {
  console.error('Failed to start task scheduler:', error);
  process.exit(1);
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Shutting down gracefully...');
  taskScheduler.stop();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  taskScheduler.stop();
  await prisma.$disconnect();
  process.exit(0);
}); 