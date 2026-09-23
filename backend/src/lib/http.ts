import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError, type z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} не найден(а)`);

/** Разбирает тело запроса по схеме; ошибка превращается в ответ 400 с понятными полями */
export function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  return schema.parse(body ?? {});
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Проверьте заполнение полей',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err && typeof err === 'object' && 'code' in err && err.code === 'P2025') {
    res.status(404).json({ error: 'Запись не найдена' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
};
