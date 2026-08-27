import { Request, Response, NextFunction } from 'express';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }
  next();
};

export const requireRole = (...allowedRoles: Array<"admin" | "teacher" | "student">) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
        }
        if (!req.user.role || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: "Forbidden", message: "You don't have permission to do this." });
        }
        next();
    };
};