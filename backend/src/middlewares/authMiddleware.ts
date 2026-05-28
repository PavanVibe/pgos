import { Request, Response, NextFunction } from 'express';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  (req as any).auth = { userId: null, orgId: null };
  return next();
};

export const attachOrgContext = (req: Request, res: Response, next: NextFunction) => {
  const { auth } = req as any;
  if (auth && auth.orgId) {
    req.headers['x-org-id'] = auth.orgId;
  }
  next();
};