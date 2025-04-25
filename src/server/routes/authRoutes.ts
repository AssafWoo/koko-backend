import express, { Router, Request, Response } from 'express';
import passport from '../config/auth';

const router = Router();

// Google OAuth login route
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback route
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req: Request, res: Response) => {
    // Successful authentication, redirect to the frontend
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
  }
);

// Logout route
router.get('/logout', (req: Request, res: Response) => {
  req.logout(() => {
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
  });
});

// Get current user
router.get('/me', (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

export default router; 