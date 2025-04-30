"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
// Configure Passport to use Google OAuth
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
    scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
            return done(new Error('No email provided from Google'));
        }
        let user = await prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    email,
                    username: email.split('@')[0],
                    password: '', // Empty password for OAuth users
                    name: profile.displayName
                }
            });
        }
        const { password, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
    }
    catch (error) {
        return done(error);
    }
}));
// Serialize user into the session
passport_1.default.serializeUser((user, done) => {
    done(null, user.id);
});
// Deserialize user from the session
passport_1.default.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id }
        });
        if (!user) {
            return done(new Error('User not found'));
        }
        const { password, ...userWithoutPassword } = user;
        done(null, userWithoutPassword);
    }
    catch (error) {
        done(error);
    }
});
exports.default = passport_1.default;
