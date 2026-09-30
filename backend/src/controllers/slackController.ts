import { Request, Response } from 'express';
import prisma from '../config/db';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const startOAuth = (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  
  // pass userId in state param so we can identify them when slack redirects back
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
  
  const url = `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=chat:write,chat:write.public,incoming-webhook&redirect_uri=${process.env.SLACK_REDIRECT_URI}&state=${state}`;
  res.redirect(url);
};

export const handleCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    
    // decode user id from state
    let userId: string;
    try {
      const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString());
      userId = decoded.userId;
    } catch (e) {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?slack=error`);
    }

    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: process.env.SLACK_REDIRECT_URI
      }
    });

    if (!response.data.ok) {
      throw new Error(response.data.error);
    }

    const { access_token, team } = response.data;
    const webhook = response.data.incoming_webhook?.url;

    await prisma.user.update({
      where: { id: userId },
      data: {
        slackAccessToken: access_token,
        slackWebhookUrl: webhook || null,
        slackTeamId: team?.id || null
      }
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (err) {
    console.error('Slack OAuth error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?slack=error`);
  }
};

export const disconnect = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  await prisma.user.update({
    where: { id: userId },
    data: { slackAccessToken: null, slackWebhookUrl: null, slackTeamId: null }
  });
  res.json({ message: 'disconnected slack' });
};

export const getStatus = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  res.json({ 
    connected: !!(user?.slackAccessToken || user?.slackWebhookUrl),
    teamName: user?.slackTeamId || ''
  });
};
