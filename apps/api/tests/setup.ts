import { beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

process.env.MONGOMS_SYSTEM_BINARY = 'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe';

let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
  process.env.CHECKPOINT_HMAC_SECRET = 'test-hmac-secret-at-least-32-characters-long';
  process.env.NODE_ENV = 'test';
  process.env.CHECKPOINT_INTERVAL_EVENTS = '5';

  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: {
      systemBinary: 'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe',
    },
  });

  const uri = replSet.getUri();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
}, 60000);

afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
  }
}, 30000);
