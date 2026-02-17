import { Request, Response } from 'express';
import { eachDayOfInterval, addMinutes, isBefore, isAfter, startOfDay, endOfDay, getDay } from 'date-fns';
import prisma from '../config/db';

// Helper: Format date for display
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Helper: Check if time slot is available
async function isTimeSlotAvailable(
  servicePersonId: number,
  startTime: Date,
  endTime: Date,
  excludeScheduleId?: number
): Promise<boolean> {
  const overlappingSchedules = await prisma.activitySchedule.findMany({
    where: {
      servicePersonId,
      status: { in: ['PENDING', 'ACCEPTED'] },
      scheduledDate: {
        gte: startTime,
        lte: endTime,
      },
      ...(excludeScheduleId && { id: { not: excludeScheduleId } }),
    },
  });

  return overlappingSchedules.length === 0;
}

// Helper: Get available slots for a service person
async function getAvailableSlots(
  servicePersonId: number,
  fromDate: Date,
  toDate: Date
): Promise<any[]> {
  const workingDays = eachDayOfInterval({ start: fromDate, end: toDate }).filter(
    (day) => getDay(day) !== 0 // Exclude Sundays
  );

  const availableSlots: any[] = [];
  const WORK_START = 9; // 9 AM
  const WORK_END = 17.5; // 5:30 PM
  const SLOT_DURATION = 60; // 1 hour slots

  for (const day of workingDays) {
    const dayStart = new Date(day);
    dayStart.setHours(WORK_START, 0, 0, 0);

    const dayEnd = new Date(day);
    dayEnd.setHours(Math.floor(WORK_END), Math.round((WORK_END % 1) * 60), 0, 0);

    let currentTime = new Date(dayStart);

    while (isBefore(currentTime, dayEnd)) {
      const slotEnd = addMinutes(currentTime, SLOT_DURATION);

      const isAvailable = await isTimeSlotAvailable(servicePersonId, currentTime, slotEnd);

      if (isAvailable) {
        availableSlots.push({
          start: currentTime.toISOString(),
          end: slotEnd.toISOString(),
          duration: SLOT_DURATION,
        });
      }

      currentTime = slotEnd;
    }
  }

  return availableSlots;
}

// Helper: Get busy slots for a service person
async function getBusySlots(
  servicePersonId: number,
  fromDate: Date,
  toDate: Date
): Promise<any[]> {
  const schedules = await prisma.activitySchedule.findMany({
    where: {
      servicePersonId,
      status: { in: ['PENDING', 'ACCEPTED'] },
      scheduledDate: {
        gte: fromDate,
        lte: toDate,
      },
    },
    select: {
      id: true,
      scheduledDate: true,
      activityType: true,
    },
  });

  return schedules.map((schedule: any) => ({
    scheduleId: schedule.id,
    start: schedule.scheduledDate.toISOString(),
    end: addMinutes(schedule.scheduledDate, 60).toISOString(), // Default 1 hour duration
    activityType: schedule.activityType,
  }));
}

// 1. Create Activity Schedule
export const createActivitySchedule = async (req: Request, res: Response) => {
  try {
    const {
      servicePersonId,
      servicePersonIds,
      description,
      activityType,
      priority,
      scheduledDate,
      estimatedDuration,
      location,
      ticketId,
      zoneId,
      customerId,
      assetIds,
      notes,
    } = req.body;

    const user = (req as any).user;

    // Support both single and multiple service persons
    const personIds = servicePersonIds && Array.isArray(servicePersonIds)
      ? servicePersonIds
      : (servicePersonId ? [servicePersonId] : []);

    if (personIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one service person must be specified',
      });
    }

    // Validate scheduled date
    const scheduleDate = new Date(scheduledDate);
    if (isNaN(scheduleDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheduled date',
      });
    }

    // Check availability for all service persons
    const startTime = scheduleDate;
    const endTime = addMinutes(startTime, 60); // Default 1 hour duration

    for (const personId of personIds) {
      const isAvailable = await isTimeSlotAvailable(personId, startTime, endTime);
      if (!isAvailable) {
        return res.status(409).json({
          success: false,
          message: `Service person ${personId} is not available at the requested time`,
        });
      }
    }

    // Create schedules for all service persons
    const schedules = await Promise.all(
      personIds.map(personId =>
        prisma.activitySchedule.create({
          data: {
            servicePersonId: personId,
            scheduledById: user.id,
            description,
            activityType,
            priority: priority || 'MEDIUM',
            scheduledDate: new Date(scheduledDate),
            estimatedDuration: estimatedDuration ? Number(estimatedDuration) : null,
            location,
            status: 'PENDING',
            ticketId: ticketId ? Number(ticketId) : null,
            zoneId: zoneId ? Number(zoneId) : null,
            customerId: customerId ? Number(customerId) : null,
            assetIds: assetIds && assetIds.length > 0 ? assetIds : null,
            notes,
          } as any,
          include: {
            servicePerson: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            scheduledBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            ticket: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
            zone: {
              select: {
                id: true,
                name: true,
              },
            },
            customer: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
        })
      )
    );

    res.status(201).json({
      success: true,
      message: `Activity schedule created successfully for ${schedules.length} service person(s)`,
      data: schedules.length === 1 ? schedules[0] : schedules,
    });
  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create activity schedule',
    });
  }
};

// 2. Get Activity Schedules (List)
export const getActivitySchedules = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { servicePersonId, status, priority, fromDate, toDate, zoneId, page = 1, limit = 100, sortBy, sortOrder } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause
    const where: any = {};

    if (servicePersonId) {
      where.servicePersonId = Number(servicePersonId);
    }

    if (status) {
      // Handle comma-separated status values
      const statusArray = typeof status === 'string' ? status.split(',').map(s => s.trim()) : [status];
      if (statusArray.length === 1) {
        where.status = statusArray[0];
      } else {
        where.status = { in: statusArray };
      }
    }

    if (priority) {
      where.priority = priority;
    }

    if (fromDate || toDate) {
      where.scheduledDate = {};
      if (fromDate) {
        where.scheduledDate.gte = new Date(fromDate as string);
      }
      if (toDate) {
        where.scheduledDate.lte = new Date(toDate as string);
      }
    }

    // Role-based filtering for non-admin users
    if (user.role === 'SERVICE_PERSON') {
      // Service Person can only see schedules assigned to them
      where.servicePersonId = user.id;
    } else if (user.role === 'ZONE_MANAGER' || user.role === 'ZONE_USER') {
      // Only show schedules created by this user
      // This is preferred since there can be many zone users/managers in one zone
      where.scheduledById = user.id;
    } else if (zoneId) {
      where.zoneId = Number(zoneId);
    }

    // Build orderBy clause based on request parameters
    let orderBy: any = { scheduledDate: 'asc' }; // default
    if (sortBy === 'date') {
      orderBy = { scheduledDate: sortOrder === 'desc' ? 'desc' : 'asc' };
    } else if (sortBy === 'priority') {
      orderBy = { priority: sortOrder === 'desc' ? 'desc' : 'asc' };
    } else if (sortBy === 'status') {
      orderBy = { status: sortOrder === 'desc' ? 'desc' : 'asc' };
    } else if (sortBy === 'createdAt') {
      orderBy = { createdAt: sortOrder === 'desc' ? 'desc' : 'asc' };
    }

    const [schedules, total] = await Promise.all([
      prisma.activitySchedule.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id: true,
          servicePersonId: true,
          description: true,
          activityType: true,
          priority: true,
          scheduledDate: true,
          estimatedDuration: true,
          location: true,
          status: true,
          zoneId: true,
          customerId: true,
          assetIds: true,
          ticketId: true,
          createdAt: true,
          servicePerson: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          scheduledBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          ticket: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          zone: {
            select: {
              id: true,
              name: true,
            },
          },
          customer: {
            select: {
              id: true,
              companyName: true,
            },
          },
        },
        orderBy,
      }),
      prisma.activitySchedule.count({ where }),
    ]);

    res.json({
      success: true,
      data: schedules,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch activity schedules',
    });
  }
};

// 3. Get Activity Schedule Details
export const getActivityScheduleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const schedule = await prisma.activitySchedule.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        servicePersonId: true,
        description: true,
        activityType: true,
        priority: true,
        scheduledDate: true,
        estimatedDuration: true,
        location: true,  // Explicitly include location
        status: true,
        zoneId: true,
        customerId: true,
        assetIds: true,
        acceptedAt: true,
        rejectedAt: true,
        rejectionReason: true,
        completedAt: true,
        ticketId: true,
        notes: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        servicePerson: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        scheduledById: true,
        scheduledBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        ticket: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            customer: {
              select: {
                id: true,
                companyName: true,
                address: true,
              },
            },
            contact: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
            asset: {
              select: {
                id: true,
                serialNo: true,
                model: true,
                location: true,
              },
            },
          },
        },
        zone: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            companyName: true,
            address: true,
          },
        },
      },
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Activity schedule not found',
      });
    }

    // --- PERMISSION CHECK (IDOR PROTECTION) ---
    const isAdmin = user.role === 'ADMIN' || user.role === 'EXPERT_HELPDESK';
    const isSubject = schedule.servicePersonId === user.id;
    const isCreator = schedule.scheduledById === user.id;
    const userZoneIds = user.zoneIds || [];
    const isInMyZone = schedule.zoneId && userZoneIds.includes(schedule.zoneId);

    if (!isAdmin && !isSubject && !isCreator && !isInMyZone) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this schedule',
      });
    }
    // --- END PERMISSION CHECK ---

    // Fetch related activities for this schedule (activities linked via metadata.activityScheduleId)
    let relatedActivities: any[] = [];
    if (schedule) {
      // Query 1: Find activities linked via metadata.activityScheduleId
      const activitiesByScheduleId = await prisma.dailyActivityLog.findMany({
        where: {
          userId: schedule.servicePersonId,
          metadata: {
            path: ['activityScheduleId'],
            equals: schedule.id,
          },
        },
        include: {
          ActivityStage: {
            orderBy: {
              startTime: 'asc',
            },
            select: {
              id: true,
              stage: true,
              startTime: true,
              endTime: true,
              duration: true,
              location: true,
              latitude: true,
              longitude: true,
              notes: true,
              metadata: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          ticket: {
            select: {
              id: true,
              title: true,
              status: true,
              statusHistory: {
                orderBy: {
                  changedAt: 'asc',
                },
                select: {
                  id: true,
                  status: true,
                  changedAt: true,
                  notes: true,
                  changedBy: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          startTime: 'desc',
        },
      });

      // Query 2: For TICKET_WORK schedules, also find activities linked via ticketId
      let activitiesByTicketId: any[] = [];
      if (schedule.ticketId) {
        activitiesByTicketId = await prisma.dailyActivityLog.findMany({
          where: {
            userId: schedule.servicePersonId,
            ticketId: schedule.ticketId,
            activityType: 'TICKET_WORK',
          },
          include: {
            ActivityStage: {
              orderBy: {
                startTime: 'asc',
              },
              select: {
                id: true,
                stage: true,
                startTime: true,
                endTime: true,
                duration: true,
                location: true,
                latitude: true,
                longitude: true,
                notes: true,
                metadata: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            ticket: {
              select: {
                id: true,
                title: true,
                status: true,
                statusHistory: {
                  orderBy: {
                    changedAt: 'asc',
                  },
                  select: {
                    id: true,
                    status: true,
                    changedAt: true,
                    notes: true,
                    changedBy: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            startTime: 'desc',
          },
        });
      }

      // Merge and deduplicate results
      const allActivities = [...activitiesByScheduleId, ...activitiesByTicketId];

      // Helper to transform stage photos from metadata and notes
      const transformStagePhotos = (stage: any) => {
        const meta = stage.metadata || {};
        let photos: any[] = [];

        // 1. Extract from structured metadata if present
        if (Array.isArray(meta.photos)) {
          photos = meta.photos.map((photo: any) => {
            const photoUrl = photo.url || photo.thumbnailUrl || photo.cloudinaryUrl || photo.dataUrl || '';
            return {
              id: photo.id || Math.random(),
              filename: photo.filename || photo.name || 'photo',
              url: photoUrl,
              thumbnailUrl: photo.thumbnailUrl || photoUrl,
              dataUrl: photo.dataUrl || photoUrl,
              createdAt: photo.createdAt || photo.timestamp || stage.createdAt || new Date().toISOString(),
            };
          });
        }
        // 2. Fallback: extract from localUrls array if that's the structure
        else if (meta.photos?.localUrls && Array.isArray(meta.photos.localUrls)) {
          meta.photos.localUrls.forEach((url: string, index: number) => {
            photos.push({
              id: `${stage.id}_${index}`,
              filename: `photo_${index + 1}.webp`,
              url: url,
              thumbnailUrl: url,
              dataUrl: url,
              createdAt: stage.startTime || stage.createdAt || new Date().toISOString(),
            });
          });
        }

        // 3. Extract from notes text (common for Ticket Status changes)
        if (stage.notes && stage.notes.includes('/storage/images/')) {
          const urlRegex = /\/storage\/images\/[^\s,]+/g;
          const urls = stage.notes.match(urlRegex) || [];
          urls.forEach((url: string, index: number) => {
            // Avoid duplicates
            if (!photos.some((p: any) => p.url === url)) {
              photos.push({
                id: `${stage.id}_note_${index}`,
                filename: `note_photo_${index + 1}.webp`,
                url: url,
                thumbnailUrl: url,
                dataUrl: url,
                createdAt: stage.startTime || stage.createdAt || new Date().toISOString(),
              });
            }
          });
        }

        return {
          ...stage,
          accuracy: stage.accuracy ?? meta.accuracy,
          locationSource: stage.locationSource ?? meta.locationSource,
          metadata: {
            ...meta,
            photos: photos,
          },
        };
      };

      // Deduplicate by activity ID and enhance with ticket status history as stages
      const seenIds = new Set<number>();
      relatedActivities = allActivities.filter(activity => {
        if (seenIds.has(activity.id)) {
          return false;
        }
        seenIds.add(activity.id);
        return true;
      }).map(activity => {
        // Transform all activity stages to extract photos from metadata
        const transformedStages = (activity.ActivityStage || []).map(transformStagePhotos);

        // For TICKET_WORK activities, merge ticket status history into stages for timeline display
        if (activity.activityType === 'TICKET_WORK' && activity.ticket?.statusHistory) {
          const ticketStatusStages = activity.ticket.statusHistory.map((history: any) => ({
            id: `status-${history.id}`,
            stage: history.status,
            startTime: history.changedAt,
            endTime: null,
            duration: null,
            location: history.location,
            latitude: history.latitude,
            longitude: history.longitude,
            notes: history.notes,
            metadata: {
              isTicketStatus: true,
              changedBy: history.changedBy,
              accuracy: history.accuracy,
              locationSource: history.locationSource,
            },
            createdAt: history.changedAt,
            updatedAt: history.changedAt,
          })).map(transformStagePhotos);

          // Merge activity stages and ticket status changes, sorted by time
          const allStages = [...transformedStages, ...ticketStatusStages]
            .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

          return {
            ...activity,
            ActivityStage: allStages,
          };
        }
        return {
          ...activity,
          ActivityStage: transformedStages,
        };
      });
    }

    // Fetch asset details if assetIds are present
    let assetDetails: any[] = [];
    if (schedule?.assetIds && Array.isArray(schedule.assetIds) && schedule.assetIds.length > 0) {
      // Convert JsonArray to number[] for the query (handle both string and number IDs)
      const assetIds = schedule.assetIds
        .map((id: any) => typeof id === 'string' ? parseInt(id, 10) : id)
        .filter((id: any): id is number => !isNaN(id) && typeof id === 'number');

      if (assetIds.length > 0) {
        assetDetails = await prisma.asset.findMany({
          where: {
            id: { in: assetIds }
          },
          select: {
            id: true,
            serialNo: true,
            model: true,
            location: true,
            customer: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
        });
      }
    }

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Activity schedule not found',
      });
    }

    res.json({
      success: true,
      data: {
        ...schedule,
        title: schedule.description || `${schedule.activityType.replace(/_/g, ' ')} - ${formatDate(schedule.scheduledDate)}`,
        assets: assetDetails, // Include fetched asset details
        relatedActivities,
      },
    });
  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch activity schedule',
    });
  }
};
export const updateActivitySchedule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { description, priority, scheduledDate, estimatedDuration, location, notes, zoneId, customerId, assetIds } = req.body;

    const schedule = await prisma.activitySchedule.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        servicePersonId: true,
      },
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Activity schedule not found',
      });
    }

    // Allow editing for all statuses
    // Note: Be careful when editing schedules that are already in progress

    // Check availability if date changed
    if (scheduledDate) {
      const newDate = new Date(scheduledDate);
      const endTime = addMinutes(newDate, 60); // Default 1 hour duration

      const isAvailable = await isTimeSlotAvailable(schedule.servicePersonId, newDate, endTime, Number(id));
      if (!isAvailable) {
        return res.status(409).json({
          success: false,
          message: 'New time slot not available for this service person',
        });
      }
    }

    const updated = await prisma.activitySchedule.update({
      where: { id: Number(id) },
      data: {
        ...(description !== undefined && { description }),
        ...(priority && { priority }),
        ...(scheduledDate && { scheduledDate: new Date(scheduledDate) }),
        ...(estimatedDuration !== undefined && { estimatedDuration: estimatedDuration ? Number(estimatedDuration) : null }),
        ...(location && { location }),
        ...(notes !== undefined && { notes }),
        ...(zoneId !== undefined && { zoneId: zoneId ? Number(zoneId) : null }),
        ...(customerId !== undefined && { customerId: customerId ? Number(customerId) : null }),
        ...(assetIds !== undefined && { assetIds: assetIds && assetIds.length > 0 ? assetIds : null }),
      },
      include: {
        servicePerson: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        scheduledBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        ticket: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        zone: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Activity schedule updated successfully',
      data: updated,
    });
  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update activity schedule',
    });
  }
};

// 5. Accept Schedule (Service Person)
export const acceptActivitySchedule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const schedule = await prisma.activitySchedule.findUnique({
      where: { id: Number(id) },
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Activity schedule not found',
      });
    }

    // Only service person can accept their own schedules
    if (schedule.servicePersonId !== user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only accept your own schedules',
      });
    }

    if (schedule.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Can only accept schedules with PENDING status',
      });
    }

    const updated = await prisma.activitySchedule.update({
      where: { id: Number(id) },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
      include: {
        servicePerson: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        scheduledBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Activity schedule accepted',
      data: updated,
    });
  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to accept activity schedule',
    });
  }
};

// 6. Reject Schedule (Service Person)
export const rejectActivitySchedule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const user = (req as any).user;

    const schedule = await prisma.activitySchedule.findUnique({
      where: { id: Number(id) },
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Activity schedule not found',
      });
    }

    // Only service person can reject their own schedules
    if (schedule.servicePersonId !== user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only reject your own schedules',
      });
    }

    if (schedule.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Can only reject schedules with PENDING status',
      });
    }

    const updated = await prisma.activitySchedule.update({
      where: { id: Number(id) },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason,
      },
      include: {
        servicePerson: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        scheduledBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Activity schedule rejected',
      data: updated,
    });
  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reject activity schedule',
    });
  }
};

// 7. Complete Schedule
export const completeActivitySchedule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const schedule = await prisma.activitySchedule.findUnique({
      where: { id: Number(id) },
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Activity schedule not found',
      });
    }

    if (schedule.status !== 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        message: 'Can only complete schedules with ACCEPTED status',
      });
    }

    const updated = await prisma.activitySchedule.update({
      where: { id: Number(id) },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      include: {
        servicePerson: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        scheduledBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Activity schedule completed',
      data: updated,
    });
  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete activity schedule',
    });
  }
};

// 8. Cancel Schedule
export const cancelActivitySchedule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const schedule = await prisma.activitySchedule.findUnique({
      where: { id: Number(id) },
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Activity schedule not found',
      });
    }

    if (schedule.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Can only cancel schedules with PENDING status',
      });
    }

    const updated = await prisma.activitySchedule.update({
      where: { id: Number(id) },
      data: {
        status: 'CANCELLED',
        notes: reason ? `Cancelled: ${reason}` : 'Cancelled',
      },
      include: {
        servicePerson: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        scheduledBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Activity schedule cancelled',
      data: updated,
    });
  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel activity schedule',
    });
  }
};

// 9. Get Service Person Availability
export const getServicePersonAvailability = async (req: Request, res: Response) => {
  try {
    const { servicePersonId } = req.params;
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'fromDate and toDate are required',
      });
    }

    const from = new Date(fromDate as string);
    const to = new Date(toDate as string);

    const [availableSlots, busySlots] = await Promise.all([
      getAvailableSlots(Number(servicePersonId), from, to),
      getBusySlots(Number(servicePersonId), from, to),
    ]);

    // Suggest best times (first 3 available slots)
    const suggestedTimes = availableSlots.slice(0, 3);

    res.json({
      success: true,
      data: {
        availableSlots,
        busySlots,
        suggestedTimes,
        totalAvailableSlots: availableSlots.length,
        totalBusySlots: busySlots.length,
      },
    });
  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get service person availability',
    });
  }
};

// 10. Suggest Optimal Schedule
export const suggestOptimalSchedule = async (req: Request, res: Response) => {
  try {
    const { servicePersonIds, activityType, estimatedDuration, priority, fromDate, toDate } = req.body;

    if (!servicePersonIds || !Array.isArray(servicePersonIds) || servicePersonIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'servicePersonIds array is required',
      });
    }

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'fromDate and toDate are required',
      });
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    const suggestions: any[] = [];

    for (const spId of servicePersonIds) {
      const availableSlots = await getAvailableSlots(spId, from, to);

      if (availableSlots.length > 0) {
        // Get the first available slot
        const bestSlot = availableSlots[0];

        const servicePerson = await prisma.user.findUnique({
          where: { id: spId },
          select: {
            id: true,
            name: true,
            email: true,
          },
        });

        suggestions.push({
          servicePersonId: spId,
          servicePerson,
          suggestedDate: bestSlot.start,
          reason: `Available slot found. ${availableSlots.length} total slots available in the period.`,
          availableSlotsCount: availableSlots.length,
        });
      }
    }

    // Sort by availability (most available first)
    suggestions.sort((a, b) => b.availableSlotsCount - a.availableSlotsCount);

    res.json({
      success: true,
      data: {
        suggestions,
        totalSuggestions: suggestions.length,
      },
    });
  } catch (error: any) {

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to suggest optimal schedule',
    });
  }
};
