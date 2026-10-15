import type { Request, Response } from 'express';

/**
 * The caller is authenticated by the route middleware before this handler.
 * Ignore validators from earlier cached responses so each check returns a
 * fresh 200, and prevent the device or an intermediary from storing it.
 */
export function accountSessionCheckHandler(request: Request, response: Response): void {
  delete request.headers['if-none-match'];
  delete request.headers['if-modified-since'];
  response.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Expires: '0',
    Pragma: 'no-cache',
  });
  response.status(200).json({ ok: true, data: { authenticated: true } });
}
