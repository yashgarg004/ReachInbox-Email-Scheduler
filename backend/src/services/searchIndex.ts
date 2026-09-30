import elasticClient from '../config/elastic';

export const indexEmail = async (emailData: any) => {
  try {
    await elasticClient.index({
      index: 'emails',
      id: emailData.id,
      body: emailData
    });
  } catch (err) {
    console.error('Failed to index email', err);
  }
};

export const searchEmails = async (query: string, userId: string, filters: any = {}) => {
  try {
    const must: any[] = [
      { term: { userId } }
    ];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['subject', 'body', 'recipientEmail', 'senderEmail']
        }
      });
    }

    if (filters.status) must.push({ term: { status: filters.status } });

    const result = await elasticClient.search({
      index: 'emails',
      body: {
        query: { bool: { must } },
        sort: [{ scheduledAt: { order: 'desc' } }]
      }
    });

    return result.hits.hits.map((h: any) => ({ _id: h._id, ...h._source }));
  } catch (err) {
    console.error('Search failed', err);
    return [];
  }
};

export const updateEmailIndex = async (id: string, updates: any) => {
  try {
    await elasticClient.update({
      index: 'emails',
      id,
      body: { doc: updates }
    });
  } catch (err) {
    console.error('Failed to update email index', err);
  }
};
