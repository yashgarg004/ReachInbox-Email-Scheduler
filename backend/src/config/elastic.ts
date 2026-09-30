import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

const elasticClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
});

export const initEmailIndex = async () => {
  try {
    const indexName = 'emails';
    const indexExists = await elasticClient.indices.exists({ index: indexName });

    if (!indexExists) {
      await elasticClient.indices.create({
        index: indexName,
        body: {
          mappings: {
            properties: {
              recipientEmail: { type: 'keyword' },
              senderEmail: { type: 'keyword' },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              userId: { type: 'keyword' },
              batchId: { type: 'keyword' },
            }
          }
        }
      });
      console.log('Elasticsearch index "emails" created');
    }
  } catch (error) {
    console.error('Error initializing elasticsearch index:', error);
  }
};

export default elasticClient;
