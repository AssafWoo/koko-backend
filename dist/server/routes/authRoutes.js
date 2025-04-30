"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("@server/config/auth"));
const router = (0, express_1.Router)();
// Google OAuth login route
router.get('/google', auth_1.default.authenticate('google', { scope: ['profile', 'email'] }));
// Google OAuth callback route
router.get('/google/callback', auth_1.default.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
    // Successful authentication, redirect to the frontend
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
});
// Logout route
router.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
    });
});
// Get current user
router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    }
    else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});
exports.default = router;
