import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { extractTokenFromRequest } from '../auth-cookie';

/** Lokal `/uploads/*` fayllariga faqat autentifikatsiyadan o‘tgan foydalanuvchilar kirishi mumkin. */
export function createUploadsAuthMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
      return next();
    }

    const token = extractTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ message: 'Token topilmadi' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(503).json({ message: 'Server sozlanmagan' });
    }

    try {
      jwt.verify(token, secret);
      return next();
    } catch {
      return res.status(401).json({ message: 'Yaroqsiz token' });
    }
  };
}
