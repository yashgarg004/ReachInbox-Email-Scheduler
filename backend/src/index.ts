import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from 'passport';

// configs & init
import prisma from './config/db';
import { initEmailIndex } from './config/elastic';
import { startWorker, recoverOrphanedJobs } from './services/worker';
import { bullBoardAdapter } from './services/queue';

// routes
import authRoutes from './routes/auth';
import emailRoutes from './routes/emails';
import slackRoutes from './routes/slack';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// session required for passport google oauth mostly
app.use(session({
  secret: process.env.SESSION_SECRET || 'session_secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// mount routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);

// bull board dashboard
app.use('/admin/queues', bullBoardAdapter.getRouter());

// start
const bootstrap = async () => {
  try {
    // try indexing
    await initEmailIndex();
    
    // recover jobs
    await recoverOrphanedJobs();

    // start bullmq worker
    startWorker();

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(async () => {
        await prisma.$disconnect();
        console.log('HTTP server closed');
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('Failed to start server:', err);
  }
};

bootstrap();
