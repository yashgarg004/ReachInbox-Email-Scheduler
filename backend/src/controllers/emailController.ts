import { Request, Response } from 'express';
import prisma from '../config/db';
import { scheduleEmail as enqueueEmail, scheduleBatch as enqueueBatch } from '../services/queue';
import { indexEmail, searchEmails as esSearch } from '../services/searchIndex';
import { parseCsvEmails, generateBatchId, calculateDelay } from '../utils/helpers';
import { createEtherealAccount } from '../services/mailer';

export const scheduleEmail = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { senderEmail, recipientEmail, subject, body, scheduledAt } = req.body;

    // quick hack to ensure sender exists
    let sender = await prisma.senderAccount.findFirst({ where: { email: senderEmail, userId } });
    if (!sender) {
      const acc = await createEtherealAccount();
      sender = await prisma.senderAccount.create({
        data: { userId, email: senderEmail, etherealUser: acc.user, etherealPass: acc.pass }
      });
    }

    const jobDate = new Date(scheduledAt);
    
    const dbJob = await prisma.emailJob.create({
      data: {
        userId, senderEmail, recipientEmail, subject, body, scheduledAt: jobDate
      }
    });

    const delayMs = calculateDelay(jobDate);
    const bullJob = await enqueueEmail(dbJob as any, delayMs);

    await prisma.emailJob.update({
      where: { id: dbJob.id },
      data: { bullJobId: bullJob.id }
    });

    await indexEmail(dbJob);

    res.json({ message: 'email scheduled', jobId: dbJob.id });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'duplicate email schedule' });
    res.status(500).json({ error: 'something went wrong' });
  }
};

export const scheduleBatch = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { senderEmail, subject, body, scheduledAt, delayBetween } = req.body;
    let recipients: string[] = [];

    if (req.file) {
      recipients = await parseCsvEmails(req.file.buffer);
    } else if (req.body.recipients) {
      recipients = JSON.parse(req.body.recipients);
    }

    if (!recipients.length) return res.status(400).json({ error: 'no recipients provided' });

    let sender = await prisma.senderAccount.findFirst({ where: { email: senderEmail, userId } });
    if (!sender) {
      const acc = await createEtherealAccount();
      sender = await prisma.senderAccount.create({
        data: { userId, email: senderEmail, etherealUser: acc.user, etherealPass: acc.pass }
      });
    }

    const batchId = generateBatchId();
    const jobDate = new Date(scheduledAt);
    const baseDelay = calculateDelay(jobDate);
    const interval = parseInt(delayBetween || '5000', 10);

    const jobs = recipients.map((recEmail) => ({
      userId, senderEmail, recipientEmail: recEmail, subject, body, scheduledAt: jobDate, batchId
    }));

    // create db records
    const createdJobs = await prisma.$transaction(
      jobs.map(j => prisma.emailJob.create({ data: j }))
    );

    // enqueue them
    const queueData = createdJobs.map(cj => ({
      data: cj as any,
      delayMs: baseDelay
    }));

    await enqueueBatch(queueData, interval);
    
    for (const cj of createdJobs) {
      await indexEmail(cj);
    }

    res.json({ message: 'batch scheduled', batchId, count: recipients.length });
  } catch (err: any) {
    res.status(500).json({ error: 'something went wrong' });
  }
};

export const getScheduledEmails = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '20', 10);
  const skip = (page - 1) * limit;

  const where = { userId, status: { in: ['SCHEDULED' as const, 'QUEUED' as const, 'RATE_LIMITED' as const] } };

  const [emails, total] = await Promise.all([
    prisma.emailJob.findMany({ where, skip, take: limit, orderBy: { scheduledAt: 'asc' } }),
    prisma.emailJob.count({ where })
  ]);

  res.json({ emails, total, page, totalPages: Math.ceil(total / limit) });
};

export const getSentEmails = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '20', 10);
  const skip = (page - 1) * limit;

  const where = { userId, status: { in: ['SENT' as const, 'FAILED' as const] } };

  const [emails, total] = await Promise.all([
    prisma.emailJob.findMany({ where, skip, take: limit, orderBy: { sentAt: 'desc' } }),
    prisma.emailJob.count({ where })
  ]);

  res.json({ emails, total, page, totalPages: Math.ceil(total / limit) });
};

export const searchEmails = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const q = req.query.q as string || '';
  const status = req.query.status as string;

  const results = await esSearch(q, userId, { status });
  res.json(results);
};

export const cancelScheduledEmail = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const jobRecord = await prisma.emailJob.findFirst({ 
      where: { id: req.params.id, userId } 
    });
    
    if (!jobRecord) return res.status(404).json({ error: 'not found' });

    // pull it from bullmq if it has a job id
    if (jobRecord.bullJobId) {
      const { emailQueue } = await import('../services/queue');
      const bullJob = await emailQueue.getJob(jobRecord.bullJobId);
      if (bullJob) await bullJob.remove();
    }

    await prisma.emailJob.delete({ where: { id: req.params.id } });
    res.json({ message: 'cancelled' });
  } catch (err) {
    console.error('cancel failed:', err);
    res.status(500).json({ error: 'failed to cancel' });
  }
};

export const getEmailStats = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const [scheduled, sent, failed] = await Promise.all([
    prisma.emailJob.count({ where: { userId, status: { in: ['SCHEDULED', 'QUEUED', 'RATE_LIMITED'] } } }),
    prisma.emailJob.count({ where: { userId, status: 'SENT' } }),
    prisma.emailJob.count({ where: { userId, status: 'FAILED' } }),
  ]);

  res.json({ scheduled, sent, failed });
};
