import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

export const googleCallback = (req: Request, res: Response) => {
  const user = req.user as any;
  if (!user) {
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }

  const token = jwt.sign(
    { id: user.id, email: user.email }, 
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '7d' }
  );

  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  // frontend handles token extraction at /auth/callback
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const jwtPayload = (req as any).user;
    // fetch actual user data from db, not just jwt payload
    const user = await prisma.user.findUnique({
      where: { id: jwtPayload.id },
      select: { id: true, email: true, name: true, avatar: true }
    });
    if (!user) return res.status(404).json({ error: 'user not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'something went wrong' });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'logged out successfully' });
};
