import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { EmailJobData } from '../types';

export const emailQueue = new Queue('email-scheduler', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 5000,
  }
});

export const scheduleEmail = async (jobData: EmailJobData, delayMs: number) => {
  return await emailQueue.add('send-email', jobData, { delay: Math.max(0, delayMs) });
};

export const scheduleBatch = async (jobs: { data: EmailJobData, delayMs: number }[], delayBetween: number) => {
  const bulkJobs = jobs.map((j, i) => ({
    name: 'send-email',
    data: j.data,
    opts: { delay: Math.max(0, j.delayMs + (i * delayBetween)) }
  }));
  
  return await emailQueue.addBulk(bulkJobs);
};

// setup bull board adapter
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

export { serverAdapter as bullBoardAdapter };
