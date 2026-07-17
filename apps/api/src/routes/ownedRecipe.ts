import type { Request } from 'express';

export function getAuthenticatedUserId(request: Request) {
  if (!request.auth?.userId) {
    throw new Error('Authenticated request context was missing.');
  }
  return request.auth.userId;
}
