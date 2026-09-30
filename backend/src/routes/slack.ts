import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { startOAuth, handleCallback, disconnect, getStatus } from '../controllers/slackController';

const router = Router();

// not protected since it's the oauth callback from slack
router.get('/callback', handleCallback);

router.use(requireAuth);
router.get('/connect', startOAuth);
router.post('/disconnect', disconnect);
router.get('/status', getStatus);

export default router;
