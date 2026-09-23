import { createApp } from './app.js';
import { prisma } from './db.js';
import { env } from './env.js';

const app = createApp();

const server = app.listen(env.EXPRESS_PORT, () => {
  console.log(`API запущен: http://localhost:${env.EXPRESS_PORT}/api/health`);
  console.log(env.openaiEnabled ? `ИИ: OpenAI, модель ${env.OPENAI_MODEL}` : 'ИИ: ключ OpenAI не задан — работают локальные правила');
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
