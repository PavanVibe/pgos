import prisma from '../utils/prisma';
import { InvoiceStatus } from '@prisma/client';
import { OverdueService } from './automation/OverdueService';

export class OperationalSummaryService {
  /**
   * Aggregates tasks prioritizing urgency.
   */
  static async getTasksSummary(pgId: string) {
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));

    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date();
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const [
      overdueList,
      unresolvedComplaints,
      urgentComplaints,
      vacantBeds,
      moveOutsToday,
      rentDueTomorrow,
    ] = await Promise.all([
      // Fetch active unpaid rent invoices to compile operational states cleanly without duplication
      OverdueService.getOverdueResidentsList(pgId, [InvoiceStatus.PENDING, InvoiceStatus.PAST_DUE]),
      // Unresolved complaints
      prisma.complaint.count({
        where: { pgId, status: { in: ['PENDING', 'ESCALATED'] } },
      }),
      // Urgent complaints
      prisma.complaint.count({
        where: { pgId, status: { in: ['PENDING', 'ESCALATED'] }, priority: { in: ['HIGH', 'URGENT'] } },
      }),
      // Vacant beds
      prisma.bed.count({
        where: { room: { pgId }, tenantProfile: null, isActive: true },
      }),
      // Move-outs today
      prisma.pGTenantProfile.count({
        where: {
          pgId,
          status: 'NOTICE',
          moveOutDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      // Rent due tomorrow
      prisma.rentInvoice.count({
        where: {
          tenantProfile: { pgId },
          status: 'PENDING',
          dueDate: { gte: tomorrowStart, lte: tomorrowEnd },
          isActive: true
        },
      }),
    ]);

    // Format metrics
    const overdueCount = overdueList.filter(res => res.status === 'PAST_DUE').length;

    const isDueToday = (dueDateStr: string | Date) => {
      const d = new Date(dueDateStr);
      const today = new Date();
      return d.getDate() === today.getDate() &&
             d.getMonth() === today.getMonth() &&
             d.getFullYear() === today.getFullYear();
    };
    const dueTodayCount = overdueList.filter(res => res.status === 'PENDING' && isDueToday(res.dueDate)).length;

    // Chronic delay warnings generated ONLY for residents with active dues
    const chronicDelayTenants = Array.from(new Set(
      overdueList
        .filter(res => res.reliability === 'CHRONIC_DELAY')
        .map(res => res.tenantProfileId)
    ));
    const chronicDelayCount = chronicDelayTenants.length;

    // Format tasks array
    const tasks = [];

    // 1. Overdue payments
    if (overdueCount > 0) {
      tasks.push({
        id: 'overdue_invoices',
        title: `${overdueCount} Overdue Payment${overdueCount > 1 ? 's' : ''}`,
        subtitle: 'Immediate collection follow-up required',
        type: 'invoice',
        urgency: 'high',
        actionLabel: 'Follow Up',
      });
    }

    // 2. Urgent complaints
    if (urgentComplaints > 0) {
      tasks.push({
        id: 'urgent_complaints',
        title: `${urgentComplaints} Urgent Complaint${urgentComplaints > 1 ? 's' : ''}`,
        subtitle: 'Needs immediate attention',
        type: 'complaint',
        urgency: 'high',
        actionLabel: 'Resolve',
      });
    }

    // 3. Due today collections
    if (dueTodayCount > 0) {
      tasks.push({
        id: 'due_today_collections',
        title: `${dueTodayCount} Rent${dueTodayCount > 1 ? 's' : ''} Due Today`,
        subtitle: 'Requires collection follow-up',
        type: 'invoice',
        urgency: 'medium',
        actionLabel: 'Collect',
      });
    }

    // 4. Chronic delay warnings
    if (chronicDelayCount > 0) {
      tasks.push({
        id: 'chronic_delay_tenants',
        title: `${chronicDelayCount} High-risk Delayed Tenant${chronicDelayCount > 1 ? 's' : ''}`,
        subtitle: 'Repeated late payment behavior detected',
        type: 'invoice',
        urgency: 'medium',
        actionLabel: 'Review',
      });
    }

    // 5. Normal/unresolved complaints
    const normalComplaints = unresolvedComplaints - urgentComplaints;
    if (normalComplaints > 0) {
      tasks.push({
        id: 'unresolved_complaints',
        title: `${normalComplaints} Pending Complaint${normalComplaints > 1 ? 's' : ''}`,
        subtitle: 'Requires follow-up',
        type: 'complaint',
        urgency: 'low',
        actionLabel: 'View',
      });
    }

    // 6. Vacant beds
    if (vacantBeds > 0) {
      tasks.push({
        id: 'vacant_beds',
        title: `${vacantBeds} Vacant Bed${vacantBeds > 1 ? 's' : ''}`,
        subtitle: 'Available for onboarding',
        type: 'onboarding',
        urgency: 'low',
        actionLabel: 'Onboard',
      });
    }

    // 7. Move-outs today
    if (moveOutsToday > 0) {
      tasks.push({
        id: 'move_outs_today',
        title: `${moveOutsToday} Move-out${moveOutsToday > 1 ? 's' : ''} Today`,
        subtitle: 'Settle dues and vacate beds',
        type: 'vacate',
        urgency: 'low',
        actionLabel: 'Process',
      });
    }

    // 8. Rent due tomorrow
    if (rentDueTomorrow > 0) {
      tasks.push({
        id: 'rent_due_tomorrow',
        title: `${rentDueTomorrow} Rent Due Tomorrow`,
        subtitle: 'Proactive reminder recommended',
        type: 'invoice',
        urgency: 'low',
        actionLabel: 'Remind',
      });
    }

    // Sort tasks strictly based on operational urgency priority mapping
    const priorityRank: Record<string, number> = {
      overdue_invoices: 1,
      urgent_complaints: 2,
      due_today_collections: 3,
      chronic_delay_tenants: 4,
      unresolved_complaints: 5,
      vacant_beds: 6,
      move_outs_today: 7,
      rent_due_tomorrow: 8
    };

    tasks.sort((a, b) => {
      const rA = priorityRank[a.id] ?? 99;
      const rB = priorityRank[b.id] ?? 99;
      return rA - rB;
    });

    return tasks;
  }

  /**
   * Aggregates occupancy state from beds.
   */
  static async getOccupancySummary(pgId: string) {
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));

    const [totalBeds, occupiedBeds, moveOutsToday] = await Promise.all([
      prisma.bed.count({
        where: { room: { pgId }, isActive: true },
      }),
      prisma.bed.count({
        where: { room: { pgId }, isActive: true, tenantProfile: { isNot: null } },
      }),
      prisma.pGTenantProfile.count({
        where: {
          pgId,
          status: 'NOTICE',
          moveOutDate: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]);

    const vacantBeds = totalBeds - occupiedBeds;
    const occupancyPercentage = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return {
      totalBeds,
      occupiedBeds,
      vacantBeds,
      occupancyPercentage,
      moveOutsToday,
      blockedBeds: 0, // Hardcoded for now unless you have a blocked status
    };
  }

  static async getActivityFeed(pgId: string, limit = 10) {
    const allLogs = await prisma.eventLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const filtered = allLogs.filter((log) => {
      if (!log.metadata) return false;
      try {
        const meta = typeof log.metadata === 'string' 
          ? JSON.parse(log.metadata) 
          : (log.metadata as any);
        return meta && meta.pgId === pgId;
      } catch (e) {
        return false;
      }
    });

    const sliced = filtered.slice(0, limit);

    // Resolve room/bed and resident names dynamically before rendering
    const enrichedLogs = [];
    for (const log of sliced) {
      const meta = typeof log.metadata === 'string'
        ? JSON.parse(log.metadata)
        : { ...(log.metadata as any) };

      try {
        if (log.eventType === 'TENANT_MOVED_IN' || log.eventType === 'BED_ALLOCATED' || log.eventType === 'RESIDENT_ONBOARDED') {
          const profile = await prisma.pGTenantProfile.findFirst({
            where: { id: log.entityId },
            include: {
              globalTenant: { select: { name: true } },
              room: { select: { number: true } },
              bed: { select: { bedNumber: true } }
            }
          });
          if (profile) {
            meta.tenantName = profile.globalTenant.name || 'Resident';
            meta.roomNumber = profile.room?.number || profile.historicalRoomNumber || 'N/A';
            meta.bedNumber = profile.bed?.bedNumber || profile.historicalBedNumber || 'N/A';
          }
          if ((!meta.roomNumber || meta.roomNumber === 'N/A' || !meta.bedNumber || meta.bedNumber === 'N/A') && meta.bedId) {
            const bed = await prisma.bed.findFirst({
              where: { id: meta.bedId },
              include: { room: { select: { number: true } } }
            });
            if (bed) {
              meta.roomNumber = meta.roomNumber && meta.roomNumber !== 'N/A' ? meta.roomNumber : (bed.room?.number || 'N/A');
              meta.bedNumber = meta.bedNumber && meta.bedNumber !== 'N/A' ? meta.bedNumber : (bed.bedNumber || 'N/A');
            }
          }
        } else if (log.eventType === 'TENANT_MOVED_OUT' || log.eventType === 'BED_VACATED' || log.eventType === 'RESIDENT_VACATED') {
          // Check profile (can include soft-deleted / inactive states)
          const profile = await prisma.pGTenantProfile.findFirst({
            where: { id: log.entityId },
            include: {
              globalTenant: { select: { name: true } },
              room: { select: { number: true } },
              bed: { select: { bedNumber: true } }
            }
          });
          if (profile) {
            meta.tenantName = profile.globalTenant.name || 'Resident';
            meta.roomNumber = profile.room?.number || profile.historicalRoomNumber || 'N/A';
            meta.bedNumber = profile.bed?.bedNumber || profile.historicalBedNumber || 'N/A';
          }
          if ((!meta.roomNumber || meta.roomNumber === 'N/A' || !meta.bedNumber || meta.bedNumber === 'N/A') && meta.bedId) {
            // Manual fallback if profile record is missing/purged or room/bed details missing
            const bed = await prisma.bed.findFirst({
              where: { id: meta.bedId },
              include: { room: { select: { number: true } } }
            });
            if (bed) {
              meta.roomNumber = meta.roomNumber && meta.roomNumber !== 'N/A' ? meta.roomNumber : (bed.room?.number || 'N/A');
              meta.bedNumber = meta.bedNumber && meta.bedNumber !== 'N/A' ? meta.bedNumber : (bed.bedNumber || 'N/A');
            }
          }
        } else if (log.eventType === 'COMPLAINT_CREATED' || log.eventType === 'COMPLAINT_RAISED') {
          const complaint = await prisma.complaint.findUnique({
            where: { id: log.entityId },
            include: {
              tenantProfile: {
                include: {
                  room: { select: { number: true } },
                  globalTenant: { select: { name: true } }
                }
              }
            }
          });
          if (complaint) {
            meta.tenantName = complaint.tenantProfile.globalTenant.name || 'Resident';
            meta.roomNumber = complaint.tenantProfile.room?.number || complaint.tenantProfile.historicalRoomNumber || 'N/A';
          }
        } else if (log.eventType === 'COMPLAINT_RESOLVED') {
          const complaint = await prisma.complaint.findUnique({
            where: { id: log.entityId },
            include: {
              tenantProfile: {
                include: {
                  room: { select: { number: true } },
                  globalTenant: { select: { name: true } }
                }
              }
            }
          });
          if (complaint) {
            meta.tenantName = complaint.tenantProfile.globalTenant.name || 'Resident';
            meta.roomNumber = complaint.tenantProfile.room?.number || complaint.tenantProfile.historicalRoomNumber || 'N/A';
          }
        } else if (log.eventType === 'RENT_PAID') {
          const profile = await prisma.pGTenantProfile.findFirst({
            where: { id: meta.tenantId || log.entityId },
            include: {
              globalTenant: { select: { name: true } },
              room: { select: { number: true } }
            }
          });
          if (profile) {
            meta.tenantName = profile.globalTenant.name || 'Resident';
            meta.roomNumber = profile.room?.number || profile.historicalRoomNumber || 'N/A';
          }
        }
      } catch (err) {
        console.error('[getActivityFeed] Enrichment failed for log:', log.id, err);
      }

      enrichedLogs.push({
        ...log,
        metadata: meta
      });
    }

    return enrichedLogs;
  }
}
