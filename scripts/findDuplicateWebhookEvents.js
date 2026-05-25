const mongoose = require('mongoose');
const connectDB = require('../src/config/dbConnact');
const TransactionLog = require('../src/models/TransactionLog');

async function main() {
  await connectDB({ retry: false, exitOnError: false });

  const duplicates = await TransactionLog.aggregate([
    {
      $match: {
        eventType: 'webhook_received',
        webhookEventId: { $type: 'string', $ne: '' },
      },
    },
    {
      $group: {
        _id: {
          gateway: '$gateway',
          webhookEventId: '$webhookEventId',
        },
        count: { $sum: 1 },
        firstSeenAt: { $min: '$createdAt' },
        lastSeenAt: { $max: '$createdAt' },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1, lastSeenAt: -1 } },
  ]);

  if (!duplicates.length) {
    console.log('No duplicate webhook events found.');
    return;
  }

  console.log(`Found ${duplicates.length} duplicate webhook keys:`);
  for (const entry of duplicates) {
    console.log(
      `${entry._id.gateway}:${entry._id.webhookEventId} count=${entry.count} first=${entry.firstSeenAt?.toISOString?.() || entry.firstSeenAt} last=${entry.lastSeenAt?.toISOString?.() || entry.lastSeenAt}`
    );
  }

  process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error('Failed to audit duplicate webhook events:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
