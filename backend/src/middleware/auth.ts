import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { Socket } from "socket.io";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
      };
    }
  }
}

export interface JwtPayload {
  id: number;
  username: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-here";

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function authRequired(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Não autorizado" });
  }
  const payload = verifyToken(header.slice(7));
  if (!payload) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
  req.user = { id: payload.id, username: payload.username };
  next();
}

export function authSocket(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    return next(new Error("Não autorizado"));
  }
  const payload = verifyToken(token);
  if (!payload) {
    return next(new Error("Token inválido ou expirado"));
  }
  socket.data.user = { id: payload.id, username: payload.username };
  next();
}