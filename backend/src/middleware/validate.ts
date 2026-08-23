import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { badRequest } from '../utils/response.js';

function formatIssues(err: ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || 'root';
    details[key] = issue.message;
  }
  return details;
}

function buildValidate(source: 'body' | 'params' | 'query') {
  return (schema: ZodTypeAny) => (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return badRequest(res, 'Validation failed', formatIssues(err));
      }
      next(err);
    }
  };
}

export const validate = buildValidate('body');
export const validateBody = buildValidate('body');
export const validateParams = buildValidate('params');
export const validateQuery = buildValidate('query');
