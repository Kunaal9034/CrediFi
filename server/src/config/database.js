const mongoose = require('mongoose');

let mongodInstance = null;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (uri && uri !== 'mongodb://localhost:27017/justicevault') {
    try {
      console.log(`[Database] Connecting to configured MongoDB...`);
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000
      });
      console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (err) {
      console.warn(`[Database] Could not connect to configured MongoDB URI: ${err.message}`);
      console.log(`[Database] Falling back to local embedded MongoDB engine for seamless development...`);
    }
  }

  // Fallback: Check if local mongod on localhost is reachable or use MongoMemoryServer
  try {
    const conn = await mongoose.connect(uri || 'mongodb://127.0.0.1:27017/justicevault', {
      serverSelectionTimeoutMS: 2000
    });
    console.log(`[Database] Local MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (localErr) {
    console.log('[Database] Local MongoDB not detected. Bootstrapping embedded MongoDB Memory Server...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongodInstance = await MongoMemoryServer.create();
    const memoryUri = mongodInstance.getUri();
    const conn = await mongoose.connect(memoryUri);
    console.log(`[Database] Embedded MongoDB Memory Server active at: ${memoryUri}`);
    return conn;
  }
};

const closeDB = async () => {
  await mongoose.connection.close();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
};

module.exports = {
  connectDB,
  closeDB
};
