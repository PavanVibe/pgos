import prisma from '../utils/prisma';

export const searchTenantByPhone = async (phone: string) => {
  const cleanPhone = phone.replace(/\s/g, '');
  
  const tenant = await prisma.globalTenant.findUnique({
    where: { phone: cleanPhone },
    select: {
      id: true,
      name: true,
      email: true,
      kycDocUrl: true,
      trustScore: true,
      profiles: {
        where: { isActive: true },
        select: {
          pgId: true,
          status: true,
          moveOutDate: true,
          pg: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 3
      }
    }
  });
  
  return tenant;
};
