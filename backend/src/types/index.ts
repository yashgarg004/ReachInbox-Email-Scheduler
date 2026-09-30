export interface EmailJobData {
  id: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: Date;
}

export interface ScheduleEmailRequest {
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string; 
}

export interface UserPayload {
  id: string;
  email: string;
}
