import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      username?: string;
      userId?: string,
      role?: "user" | "admin"
    }
  }
}