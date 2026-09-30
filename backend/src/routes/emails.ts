import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { 
  scheduleEmail, scheduleBatch, getScheduledEmails, 
  getSentEmails, searchEmails, cancelScheduledEmail, 
  getEmailStats 
} from '../controllers/emailController';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(requireAuth);

router.post('/schedule', scheduleEmail);
router.post('/schedule-batch', upload.single('csv'), scheduleBatch);

router.get('/scheduled', getScheduledEmails);
router.get('/sent', getSentEmails);
router.get('/search', searchEmails);
router.get('/stats', getEmailStats);
router.delete('/:id', cancelScheduledEmail);

export default router;
