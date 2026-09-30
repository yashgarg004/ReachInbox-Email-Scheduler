import { redis } from '../config/redis';
import dotenv from 'dotenv';
import { Job } from 'bullmq';

dotenv.config();

const MAX_EMAILS_PER_HOUR_GLOBAL = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200', 10);
const MAX_EMAILS_PER_HOUR_SENDER = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50', 10);

export const getHourWindow = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}:${now.getUTCHours()}`;
};

export const checkRateLimit = async (senderEmail: string) => {
  const hourWindow = getHourWindow();
  
  // check both global and sender specific limits
  const senderKey = `ratelimit:${senderEmail}:${hourWindow}`;
  const globalKey = `ratelimit:global:${hourWindow}`;

  const senderCount = await redis.get(senderKey);
  const globalCount = await redis.get(globalKey);

  const currentSenderCount = parseInt(senderCount || '0', 10);
  const currentGlobalCount = parseInt(globalCount || '0', 10);

  const resetAt = new Date();
  resetAt.setUTCHours(resetAt.getUTCHours() + 1, 0, 0, 0); // start of next hour

  if (currentGlobalCount >= MAX_EMAILS_PER_HOUR_GLOBAL) {
    return { allowed: false, remaining: 0, resetAt };
  }

  if (currentSenderCount >= MAX_EMAILS_PER_HOUR_SENDER) {
    return { allowed: false, remaining: 0, resetAt };
  }

  return { 
    allowed: true, 
    remaining: MAX_EMAILS_PER_HOUR_SENDER - currentSenderCount, 
    resetAt 
  };
};

export const incrementSendCount = async (senderEmail: string) => {
  const hourWindow = getHourWindow();
  const senderKey = `ratelimit:${senderEmail}:${hourWindow}`;
  const globalKey = `ratelimit:global:${hourWindow}`;

  const multi = redis.multi();
  multi.incr(senderKey);
  multi.expire(senderKey, 3600); // 1 hr TTL
  multi.incr(globalKey);
  multi.expire(globalKey, 3600);
  
  await multi.exec();
};

export const rescheduleToNextWindow = async (job: Job) => {
  // calculate time until next hour block
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
  
  const delayMs = nextHour.getTime() - now.getTime();
  
  // re-add back to queue with delay
  await job.moveToDelayed(Date.now() + delayMs, job.token!);
};
