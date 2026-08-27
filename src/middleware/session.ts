import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";

export const sessionMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (session?.user) {
      req.user = session.user.role
        ? {
            role: session.user.role as "admin" | "teacher" | "student",
          }
        : {};
    }
  } catch (e) {
    console.error("Session check failed:", e);
  }
  next();
};