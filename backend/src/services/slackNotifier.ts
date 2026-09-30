import axios from 'axios';
import prisma from '../config/db';

export const sendSlackRateLimitNotification = async (userId: string, senderEmail: string, limit: number, window: string) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    // skip silently if no slack connected
    if (!user || (!user.slackAccessToken && !user.slackWebhookUrl)) return;

    const message = `⚠️ *Rate Limit Alert*\nEmail account \`${senderEmail}\` has hit its sending limit (${limit} emails per ${window}).\nJobs have been automatically rescheduled to the next available window.`;

    if (user.slackWebhookUrl) {
      await axios.post(user.slackWebhookUrl, { text: message });
    } else if (user.slackAccessToken) {
      // Using chat.postMessage
      await axios.post('https://slack.com/api/chat.postMessage', {
        channel: user.slackTeamId || '#general', // fallback if channel not known, in reality we'd store the selected channel
        text: message
      }, {
        headers: {
          Authorization: `Bearer ${user.slackAccessToken}`
        }
      });
    }
  } catch (error) {
    console.error('Failed to send slack notification:', error);
  }
};
