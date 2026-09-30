import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import prisma from '../config/db';
import { checkRateLimit, incrementSendCount, rescheduleToNextWindow } from './rateLimiter';
import { sendSlackRateLimitNotification } from './slackNotifier';
import { sendEmail } from './mailer';
import { indexEmail, updateEmailIndex } from './searchIndex';
import dotenv from 'dotenv';
import { EmailJobData } from '../types';

dotenv.config();

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const MIN_DELAY = parseInt(process.env.MIN_DELAY_BETWEEN_SENDS_MS || '2000', 10);
const LIMIT_PER_HOUR = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50', 10);

const processJob = async (job: Job<EmailJobData>) => {
  const { id, userId, senderEmail, recipientEmail, subject, body, scheduledAt } = job.data;
  
  // mark sending
  await prisma.emailJob.update({ where: { id }, data: { status: 'SENDING' } });

  // check rate limit
  const rateLimit = await checkRateLimit(senderEmail);
  if (!rateLimit.allowed) {
    console.log(`Rate limit hit for ${senderEmail}, rescheduling job ${id}`);
    
    // notify slack, update db, reschedule
    await sendSlackRateLimitNotification(userId, senderEmail, LIMIT_PER_HOUR, 'hour');
    await prisma.emailJob.update({ where: { id }, data: { status: 'RATE_LIMITED' } });
    await updateEmailIndex(id, { status: 'RATE_LIMITED' });
    
    await rescheduleToNextWindow(job);
    return; // we wait till delayed job runs again
  }

  try {
    // get sender creds
    const senderAcc = await prisma.senderAccount.findFirst({ where: { email: senderEmail, userId } });
    if (!senderAcc) throw new Error(`Sender account not found for ${senderEmail}`);

    // send
    const info = await sendEmail(
      { etherealUser: senderAcc.etherealUser, etherealPass: senderAcc.etherealPass },
      recipientEmail,
      subject,
      body
    );

    await incrementSendCount(senderEmail);
    
    // update status
    const sentAt = new Date();
    await prisma.emailJob.update({
      where: { id },
      data: { status: 'SENT', sentAt }
    });

    await updateEmailIndex(id, { status: 'SENT', sentAt });

    // artifical delay
    await new Promise(res => setTimeout(res, MIN_DELAY));

    return info;
  } catch (err: any) {
    console.error(`Job ${id} failed:`, err);
    await prisma.emailJob.update({
      where: { id },
      data: { status: 'FAILED', errorMessage: err.message || 'unknown error' }
    });
    await updateEmailIndex(id, { status: 'FAILED' });
    throw err;
  }
};

export const startWorker = () => {
  const worker = new Worker('email-scheduler', processJob, {
    connection: createRedisConnection(),
    concurrency: CONCURRENCY,
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with err: ${err.message}`);
  });
  
  worker.on('stalled', (jobId) => {
    console.warn(`Job ${jobId} stalled`);
  });

  console.log('Worker started');
};

// on startup recover any jobs stuck in SCHEDULED past their time
export const recoverOrphanedJobs = async () => {
  const now = new Date();
  const orphaned = await prisma.emailJob.findMany({
    where: {
      status: { in: ['SCHEDULED', 'QUEUED'] },
      scheduledAt: { lte: now },
      bullJobId: null
    }
  });

  if (orphaned.length === 0) return;

  console.log(`Found ${orphaned.length} orphaned jobs, requeueing...`);

  // lazy import to dodge circular dep with queue.ts
  const { scheduleEmail } = await import('./queue');

  for (const job of orphaned) {
    try {
      const bullJob = await scheduleEmail(job as any, 0); // send immediately since past due
      await prisma.emailJob.update({
        where: { id: job.id },
        data: { bullJobId: bullJob.id, status: 'QUEUED' }
      });
    } catch (err) {
      console.error(`Failed to recover job ${job.id}:`, err);
    }
  }

  // also recover future scheduled jobs that have no bullJobId
  const futureOrphans = await prisma.emailJob.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { gt: now },
      bullJobId: null
    }
  });

  for (const job of futureOrphans) {
    try {
      const delayMs = job.scheduledAt.getTime() - now.getTime();
      const bullJob = await scheduleEmail(job as any, delayMs);
      await prisma.emailJob.update({
        where: { id: job.id },
        data: { bullJobId: bullJob.id }
      });
    } catch (err) {
      console.error(`Failed to recover future job ${job.id}:`, err);
    }
  }
  console.log('Job recovery complete');
};
