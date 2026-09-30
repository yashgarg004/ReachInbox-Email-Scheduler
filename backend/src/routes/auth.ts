import { Router } from 'express';
import passport from 'passport';
import { googleCallback, getMe, logout } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/' }), googleCallback);

router.get('/me', requireAuth, getMe);
router.post('/logout', logout);

export default router;
