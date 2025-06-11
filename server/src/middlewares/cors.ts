import { Request, Response, NextFunction } from 'express';
import cors from 'cors';

const corsOptions = {
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'], 
  allowedHeaders: ['Content-Type', 'Authorization'], 
};

export const corsMiddleware = cors(corsOptions);

export const handleCorsErrors = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err.name === 'CorsError') {
    res.status(400).json({ error: 'CORS Error', message: err.message });
  } else {
    next(err);
  }

  console.error(err.stack);
        res.status(500).json({ error: "Something went wrong!" });
};
