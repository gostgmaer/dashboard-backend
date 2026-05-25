require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is not set');
  }

  const direct = raw
    .replace('mongodb+srv://', 'mongodb://')
    .replace('@no-sql-database.mongocluster.cosmos.azure.com', '@fc-b2dfaad05c7c-000.mongocluster.cosmos.azure.com:10260');

  console.log(direct.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@'));

  await mongoose.connect(direct, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    tls: true,
  });

  console.log('CONNECTED');
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
