import { MongoClient, Db } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MongoDB URI to .env.local');
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'toshl';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export interface MongoConnectionDiagnostics {
  client: MongoClient;
  db: Db;
  cacheHit: boolean;
  connectMs: number;
}

export async function connectToDatabaseDetailed(): Promise<MongoConnectionDiagnostics> {
  const startedAt = Date.now();

  if (cachedClient && cachedDb) {
    return {
      client: cachedClient,
      db: cachedDb,
      cacheHit: true,
      connectMs: Date.now() - startedAt
    };
  }

  console.log('Connecting to MongoDB with URI:', uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));
  
  const client = new MongoClient(uri, {
    retryWrites: true,
    w: 'majority',
  });
  
  await client.connect();
  console.log('MongoDB connected successfully');
  
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  return {
    client,
    db,
    cacheHit: false,
    connectMs: Date.now() - startedAt
  };
}

export async function connectToDatabase() {
  const { client, db } = await connectToDatabaseDetailed();
  return { client, db };
}
