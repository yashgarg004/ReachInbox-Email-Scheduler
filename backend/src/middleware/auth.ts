import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

// simple JWT verification
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'unauthorized, please log in' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    (req as any).user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
};

// setup google oauth strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0].value;
      if (!email) return done(new Error('No email found'));

      let user = await prisma.user.findUnique({ where: { email } });
      
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            googleId: profile.id,
            name: profile.displayName,
            avatar: profile.photos?.[0].value
          }
        });
      } else if (!user.googleId) {
        // user exists but hasn't linked google
        user = await prisma.user.update({
          where: { email },
          data: { googleId: profile.id, name: profile.displayName, avatar: profile.photos?.[0].value }
        });
      }
      return done(null, user);
    } catch (err: any) {
      return done(err);
    }
  }
));

// basic serializers just in case sessions are needed
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
