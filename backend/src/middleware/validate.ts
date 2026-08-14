/**
 * Zod-based request validation middleware.
 *
 * Usage:
 *   router.post('/signup', validate(signupSchema), handler)
 *
 * The schema can validate `body`, `query`, or `params`.
 * On failure, returns 400 with a consistent error shape.
 */
import { z } from 'zod'
import type { Request, Response, NextFunction } from 'express'

/**
 * Wraps a Zod schema (for body, query, or params) into Express middleware.
 * @param schema  — Zod schema to validate against
 * @param source  — which part of the request to validate
 */
export function validate(schema: z.ZodType, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }))
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors,
        },
      })
      return
    }
    // Replace original input with parsed/coerced data
    (req as any)[source] = result.data
    next()
  }
}
