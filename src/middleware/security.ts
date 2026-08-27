import { Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import helmet from "helmet";

const roleLimits: Record<string, { max: number; message: string }> = {
  admin: { max: 40, message: "Admin request limit exceeded (40 per minute). Slow down!" },
  teacher: { max: 20, message: "User request limit exceeded (20 per minute). Please wait." },
  student: { max: 20, message: "User request limit exceeded (20 per minute). Please wait." },
  guest: { max: 10, message: "Guest request limit exceeded (10 per minute). Please wait or sign up." },
};

export const rateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = (req.user as { id?: string | number } | undefined)?.id;
    return userId?.toString() || ipKeyGenerator(req.ip || "unknown");
  },
  max: (req: Request) => {
    const role = req.user?.role || "guest";
    return roleLimits[role]?.max ?? roleLimits.guest!.max;
  },
  handler: (req: Request, res: Response) => {
    const role = req.user?.role || "guest";
    const message = roleLimits[role]?.message ?? roleLimits.guest!.message;
    res.status(429).json({ error: "Too Many Requests", message });
  },
  skip: (req: Request) => process.env.NODE_ENV === "test",
});

export const helmetMiddleware = helmet();

const securityMiddleware = [helmetMiddleware, rateLimitMiddleware];

export default securityMiddleware;
