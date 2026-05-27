import { Request, Response, NextFunction } from 'express';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';

const clerkAuth = ClerkExpressRequireAuth({});

// This middleware ensures the user is authenticated via Clerk
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== 'production' || !process.env.CLERK_SECRET_KEY) {
    // Attach dev auth context
    (req as any).auth = { userId: 'dev-user-id', orgId: 'dev-org-id' };
    return next();
  }
  return clerkAuth(req as any, res as any, next as any);
};

// Middleware to attach organization context if available
export const attachOrgContext = (req: Request, res: Response, next: NextFunction) => {
  // @ts-ignore
  const { auth } = req;
  if (auth && auth.orgId) {
    req.headers['x-org-id'] = auth.orgId;
  }
  next();
};
