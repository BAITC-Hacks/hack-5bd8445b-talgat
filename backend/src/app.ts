import cors from 'cors';
import express from 'express';
import { env } from './env.js';
import { errorHandler, notFoundHandler } from './lib/http.js';
import { businessesRouter } from './routes/businesses.js';
import { catalogRouter } from './routes/catalog.js';
import { metaRouter } from './routes/meta.js';
import { tasksRouter } from './routes/tasks.js';
import { teamsRouter } from './routes/teams.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.FRONTEND_ORIGIN.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '200kb' }));

  app.use('/api', metaRouter);
  app.use('/api/businesses', businessesRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/teams', teamsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
