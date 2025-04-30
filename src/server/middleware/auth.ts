import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface JwtPayload {
  userId: string;
  username: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
      };
    }
  }
}

export const authenticateToken: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Auth headers:', req.headers);
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1] || req.query.token as string;

    if (!token) {
      console.log('No token provided');
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    console.log('Received token:', token);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as JwtPayload;
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
  } catch (error) {
    console.error('Auth error:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ message: 'Invalid token' });
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      res.status(403).json({ message: 'Token expired' });
      return;
    }
    res.status(500).json({ message: 'Authentication error' });
  }
}; 