import { IncomingMessage, ServerResponse } from 'http';
import { Request, Response, NextFunction } from 'express';

export const createAuthMiddleware = (authToken: string) => {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    // Allow health checks to pass through without auth
    if (req.method === 'GET' && req.url === '/') {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Authorization header is missing' }));
      return;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Authorization header is malformed. Expected: Bearer <token>' }));
      return;
    }

    const token = parts[1];

    // Use a timing-safe comparison to prevent timing attacks
    const isAuthorized = Buffer.compare(Buffer.from(token), Buffer.from(authToken)) === 0;

    if (!isAuthorized) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid authentication token' }));
      return;
    }

    next();
  };
};

// Express-compatible auth middleware
export const createExpressAuthMiddleware = (authToken: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Allow health checks to pass through without auth
    if (req.method === 'GET' && req.path === '/health') {
      return next();
    }

    // Allow login page and login API to pass through without auth
    if (req.path === '/login') {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      // For API requests, return JSON error
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Authorization header is missing' });
      }
      // For static files (HTML, CSS, JS), allow through - auth check will happen in frontend
      if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        return next();
      }
      // For other requests, redirect to login
      return res.redirect('/login');
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Authorization header is malformed. Expected: Bearer <token>' });
      }
      // For static files, allow through
      if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        return next();
      }
      return res.redirect('/login');
    }

    const token = parts[1];

    // Use a timing-safe comparison to prevent timing attacks
    const isAuthorized = Buffer.compare(Buffer.from(token), Buffer.from(authToken)) === 0;

    if (!isAuthorized) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Invalid authentication token' });
      }
      // For static files, allow through
      if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        return next();
      }
      return res.redirect('/login');
    }

    next();
  };
};
