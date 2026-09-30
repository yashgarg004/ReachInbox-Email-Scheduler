import nodemailer from 'nodemailer';

export const createEtherealAccount = async () => {
  return await nodemailer.createTestAccount();
};

export const sendEmail = async (senderCreds: { etherealUser: string, etherealPass: string }, to: string, subject: string, body: string) => {
  // just standard ethereal setup
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: senderCreds.etherealUser,
      pass: senderCreds.etherealPass
    }
  });

  const info = await transporter.sendMail({
    from: senderCreds.etherealUser, // ethereal requires from to match auth or be generic
    to,
    subject,
    text: body,
  });

  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info)
  };
};
