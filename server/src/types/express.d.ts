import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      sessionId?: string; // Make it optional
      customFolder?: string;
      body: {
        relativePaths?: string | { [key: string]: string };
      };
    }
  }
}
