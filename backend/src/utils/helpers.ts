import { parse } from 'csv-parse';
import crypto from 'crypto';

export const parseCsvEmails = (buffer: Buffer): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const emails: string[] = [];
    parse(buffer, { columns: true, skip_empty_lines: true }, (err, records) => {
      if (err) return reject(err);
      for (const rec of records) {
        // Look for common email headers or just take the first string with @
        const email = rec.email || rec.Email || Object.values(rec).find(v => typeof v === 'string' && v.includes('@'));
        if (email) emails.push(email as string);
      }
      resolve(emails);
    });
  });
};

export const generateBatchId = () => {
  return crypto.randomUUID();
};

export const calculateDelay = (scheduledAt: Date | string) => {
  const d = new Date(scheduledAt);
  const now = new Date();
  return Math.max(0, d.getTime() - now.getTime());
};

export const formatDate = (date: Date | string) => {
  return new Date(date).toISOString();
};
