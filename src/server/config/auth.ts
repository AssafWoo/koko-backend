import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient, User } from '@prisma/client';
import dotenv from 'dotenv';

type SafeUser = Omit<User, 'password'>;

declare global {
  namespace Express {
    interface User extends SafeUser {}
  }
}

dotenv.config();
const prisma = new PrismaClient();

// Configure Passport to use Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
    scope: ['profile', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
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
    } catch (error) {
      return done(error as Error);
    }
  }
));

// Serialize user into the session
passport.serializeUser((user: SafeUser, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id }
    });
    
    if (!user) {
      return done(new Error('User not found'));
    }

    const { password, ...userWithoutPassword } = user;
    done(null, userWithoutPassword);
  } catch (error) {
    done(error);
  }
});

export default passport; 