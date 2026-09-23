import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { env } from './env.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

// Запас по времени: на медленном диске соединение и транзакция стартуют не мгновенно
export const prisma = new PrismaClient({ adapter, transactionOptions: { maxWait: 15_000, timeout: 30_000 } });
