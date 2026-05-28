import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';

export const canAccessOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkOrgId = req.headers['x-org-id'] as string;
    const clerkUserId = (req as any).auth?.userId;

    let org = null;

    if (clerkOrgId) {
      org = await prisma.organization.findUnique({
        where: { clerkOrgId },
      });
    }

    if (!org && clerkUserId) {
      const staff = await prisma.staff.findFirst({
        where: { clerkUserId },
        include: { organization: true },
      });
      if (staff) org = staff.organization;
    }

    if (!org) {
      org = await prisma.organization.findFirst();
    }

    if (!org) {
      return res.status(403).json({ error: 'Missing active organization context. Please select or create an organization.' });
    }

    (req as any).organization = org;
    next();
  } catch (error) {
    next(error);
  }
};

export const canAccessPG = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pgId } = req.params;
    const organization = (req as any).organization;

    if (!organization || !pgId) return res.status(400).json({ error: 'Invalid request context.' });

    let pg = null;
    if (pgId !== 'demo-pg-id' && pgId !== 'demo-pg-123') {
      pg = await prisma.pG.findFirst({
        where: { id: pgId as string, organizationId: organization.id },
      });
    }

    if (!pg && process.env.NODE_ENV !== 'production') {
      pg = await prisma.pG.findFirst({
        where: { organizationId: organization.id },
      });
    }

    if (!pg) return res.status(403).json({ error: 'Access denied to this PG.' });

    (req as any).pg = pg;
    next();
  } catch (error) {
    next(error);
  }
};

export const auditAction = (action: string, entityType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    let responseBody: any;
    res.send = function (body) {
      responseBody = body;
      return originalSend.apply(res, arguments as any);
    };

    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const actorId = (req as any).auth?.userId || 'system';
        let entityId = (req.params.id || req.params.pgId || 'unknown') as string;
        try {
          if (responseBody) { const parsed = JSON.parse(responseBody); if (parsed.id) entityId = parsed.id; }
        } catch (e) { }

        if (entityId !== 'unknown') {
          await prisma.auditLog.create({
            data: {
              actorId,
              action,
              entityType,
              entityId,
              metadata: { url: req.originalUrl, method: req.method },
            }
          });
        }
      }
    });

    next();
  };
};