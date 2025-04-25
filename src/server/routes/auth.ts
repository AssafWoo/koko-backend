import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

// Login endpoint
router.post('/login', (async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('Invalid password for user:', username);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        username: user.username
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    console.log('Generated token for user:', { userId: user.id, username: user.username });

    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}) as RequestHandler);

// Token verification endpoint
router.post('/verify', (async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: number; username: string };
    
    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    res.json({ valid: true, user: { id: user.id, username: user.username } });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      res.status(403).json({ error: 'Token expired' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}) as RequestHandler);

// Logout endpoint
router.post('/logout', (req, res) => {
  // Since we're using JWT, we don't need to do anything on the server side
  // The client will remove the token from localStorage
  res.json({ message: 'Logged out successfully' });
});

export default router; 