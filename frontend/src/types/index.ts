export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export type EmailStatus = 'SCHEDULED' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'RATE_LIMITED';

export interface Email {
  id: string;
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string;
  status: EmailStatus;
  createdAt: string;
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  failed: number;
}

export interface PaginatedResponse<T> {
  emails?: T[];
  data?: T[]; // falling back just in case
  total: number;
  page: number;
  totalPages: number;
}
