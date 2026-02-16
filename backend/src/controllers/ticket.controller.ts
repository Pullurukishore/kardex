import { Request, Response } from 'express';
import prisma from '../config/db';
import { AuthUser } from '../types/express';
import { NotificationService } from '../services/notification.service';
import { TicketNotificationService } from '../services/ticket-notification.service';
import { ActivityController } from './activityController';
import { GeocodingService } from '../services/geocoding.service';
import { LocalPhotoStorageService } from '../services/local-photo-storage.service';
import { TicketStatus, Priority, CallType, OnsiteVisitEvent } from '@prisma/client';

// Enum-like object for UserRole values
const UserRoleEnum = {
  ADMIN: 'ADMIN' as const,
  ZONE_MANAGER: 'ZONE_MANAGER' as const,
  ZONE_USER: 'ZONE_USER' as const,
  SERVICE_PERSON: 'SERVICE_PERSON' as const,
  EXTERNAL_USER: 'EXTERNAL_USER' as const,
} as const;

type UserRole = 'ADMIN' | 'ZONE_MANAGER' | 'ZONE_USER' | 'SERVICE_PERSON' | 'EXTERNAL_USER';

// Remove custom TicketCreateInput type - use Prisma's generated types

// Extended Request type
type TicketRequest = Request & {
  user?: AuthUser;
  params: {
    id?: string;
  };
  query: {
    status?: string;
    priority?: string;
    page?: string;
    limit?: string;
    search?: string;
    customerId?: string;
    assignedToId?: string;
  };
  body: any;
};

// Define valid status transitions based on business workflow
// Note: IN_PROCESS has been replaced with IN_PROGRESS - temporary type assertion until Prisma migration
const validTransitions = {
  // Initial state - can be assigned or moved to pending
  [TicketStatus.OPEN]: [TicketStatus.ASSIGNED, TicketStatus.CANCELLED, TicketStatus.PENDING],

  // Assigned state - can start working on it or schedule onsite visit
  [TicketStatus.ASSIGNED]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.ONSITE_VISIT,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  // Main working state - multiple possible next steps (IN_PROGRESS replaces IN_PROCESS)
  [TicketStatus.IN_PROGRESS]: [
    TicketStatus.WAITING_CUSTOMER,
    TicketStatus.ONSITE_VISIT,
    TicketStatus.PO_NEEDED,
    TicketStatus.SPARE_PARTS_NEEDED,
    TicketStatus.CLOSED_PENDING,
    TicketStatus.CANCELLED,
    TicketStatus.RESOLVED,
    TicketStatus.ON_HOLD,
    TicketStatus.ESCALATED,
    TicketStatus.PENDING
  ],

  // Waiting for customer response
  [TicketStatus.WAITING_CUSTOMER]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.CLOSED_PENDING,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  // Onsite visit flow - comprehensive lifecycle
  [TicketStatus.ONSITE_VISIT]: [
    TicketStatus.ONSITE_VISIT_PLANNED,
    TicketStatus.IN_PROGRESS,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  [TicketStatus.ONSITE_VISIT_PLANNED]: [
    TicketStatus.ONSITE_VISIT_STARTED,
    TicketStatus.IN_PROGRESS,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  [TicketStatus.ONSITE_VISIT_STARTED]: [
    TicketStatus.ONSITE_VISIT_REACHED,
    TicketStatus.ONSITE_VISIT_PENDING,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  [TicketStatus.ONSITE_VISIT_REACHED]: [
    TicketStatus.ONSITE_VISIT_IN_PROGRESS,
    TicketStatus.ONSITE_VISIT_PENDING,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  [TicketStatus.ONSITE_VISIT_IN_PROGRESS]: [
    TicketStatus.ONSITE_VISIT_RESOLVED,
    TicketStatus.ONSITE_VISIT_PENDING,
    TicketStatus.PO_NEEDED,
    TicketStatus.SPARE_PARTS_NEEDED,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  [TicketStatus.ONSITE_VISIT_RESOLVED]: [
    TicketStatus.ONSITE_VISIT_COMPLETED,
    TicketStatus.CLOSED_PENDING,
    TicketStatus.PENDING
  ],

  [TicketStatus.ONSITE_VISIT_PENDING]: [
    TicketStatus.ONSITE_VISIT_IN_PROGRESS,
    TicketStatus.ONSITE_VISIT_COMPLETED,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  [TicketStatus.ONSITE_VISIT_COMPLETED]: [
    TicketStatus.CLOSED_PENDING,
    TicketStatus.IN_PROGRESS,
    TicketStatus.PENDING
  ],

  // Purchase order flow
  [TicketStatus.PO_NEEDED]: [
    TicketStatus.PO_REACHED,
    TicketStatus.PO_RECEIVED,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  [TicketStatus.PO_REACHED]: [
    TicketStatus.PO_RECEIVED,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  [TicketStatus.PO_RECEIVED]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  // Spare parts flow
  [TicketStatus.SPARE_PARTS_NEEDED]: [
    TicketStatus.SPARE_PARTS_BOOKED,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  [TicketStatus.SPARE_PARTS_BOOKED]: [
    TicketStatus.SPARE_PARTS_DELIVERED,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  [TicketStatus.SPARE_PARTS_DELIVERED]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  // Closing flow
  [TicketStatus.CLOSED_PENDING]: [
    TicketStatus.CLOSED,
    TicketStatus.REOPENED,
    TicketStatus.PENDING
  ],

  // Final state - no transitions out except REOPENED
  [TicketStatus.CLOSED]: [
    TicketStatus.REOPENED
  ],

  // Cancelled state - can be reopened
  [TicketStatus.CANCELLED]: [
    TicketStatus.REOPENED,
    TicketStatus.PENDING
  ],

  // Reopened ticket - goes back to assigned or in process
  [TicketStatus.REOPENED]: [
    TicketStatus.ASSIGNED,
    TicketStatus.IN_PROGRESS,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  // On hold state - temporarily paused
  [TicketStatus.ON_HOLD]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  // Escalated state - needs attention
  [TicketStatus.ESCALATED]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.CANCELLED,
    TicketStatus.PENDING
  ],

  // Resolved state - ready for closing
  [TicketStatus.RESOLVED]: [
    TicketStatus.CLOSED,
    TicketStatus.REOPENED,
    TicketStatus.PENDING
  ],

  // Pending state - initial or temporary state
  [TicketStatus.PENDING]: [
    TicketStatus.OPEN,
    TicketStatus.ASSIGNED,
    TicketStatus.IN_PROGRESS
  ]
} as Record<TicketStatus, TicketStatus[]>;

// Helper to check if status transition is valid
function isValidTransition(currentStatus: TicketStatus, newStatus: TicketStatus): boolean {
  return validTransitions[currentStatus]?.includes(newStatus) || false;
}

// Helper to update time tracking
function updateTimeTracking(ticket: any) {
  const now = new Date();
  const timeInStatus = ticket.lastStatusChange
    ? Math.floor((now.getTime() - new Date(ticket.lastStatusChange).getTime()) / 60000)
    : 0;

  const totalTimeOpen = ticket.createdAt
    ? Math.floor((now.getTime() - new Date(ticket.createdAt).getTime()) / 60000)
    : 0;

  return { timeInStatus, totalTimeOpen };
}

// Helper to check ticket access
async function checkTicketAccess(user: any, ticketId: number) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      customerId: true,
      assignedToId: true,
      zoneId: true,
      ownerId: true,
      subOwnerId: true,
      createdById: true
    }
  });
  if (!ticket) return { allowed: false, error: 'Ticket not found' };

  // Admin can access any ticket
  if (user.role === UserRoleEnum.ADMIN) {
    return { allowed: true };
  }

  // Expert helpdesk can access tickets assigned to them, owned by them, sub-owned by them, 
  // created by them, or tickets in zones they have access to (similar to zone users)
  if (user.role === 'EXPERT_HELPDESK') {
    // Check if the ticket is assigned to this user
    if (ticket.assignedToId === user.id) {
      return { allowed: true };
    }
    // Check if they own or sub-own the ticket
    if (ticket.ownerId === user.id || ticket.subOwnerId === user.id) {
      return { allowed: true };
    }
    // Check if they created the ticket
    if (ticket.createdById === user.id) {
      return { allowed: true };
    }
    // Expert helpdesk users can access all tickets (they coordinate across zones)
    return { allowed: true };
  }

  // Zone user and zone manager can access tickets assigned to them
  if (user.role === UserRoleEnum.ZONE_USER || user.role === UserRoleEnum.ZONE_MANAGER) {
    // First check if the ticket is assigned to this user
    if (ticket.assignedToId === user.id) {
      return { allowed: true };
    }
    // Zone users and zone managers can also access tickets they own or sub-own
    if (ticket.ownerId === user.id || ticket.subOwnerId === user.id) {
      return { allowed: true };
    }
    // Zone users and zone managers can access tickets they created
    if (ticket.createdById === user.id) {
      return { allowed: true };
    }
    // If user has zone IDs and ticket has a zone, check if it matches
    if (user.zoneIds && user.zoneIds.length > 0 && ticket.zoneId) {
      if (user.zoneIds.includes(ticket.zoneId)) {
        return { allowed: true };
      }
    }
    // If ticket doesn't have a zone assigned, deny access
    if (!ticket.zoneId) {
      return { allowed: false, error: 'Ticket has no zone assigned' };
    }
  }

  // Service person can access assigned tickets, tickets where they are sub-owner, tickets they created, or tickets with their accepted activity schedules
  if (user.role === UserRoleEnum.SERVICE_PERSON) {
    if (ticket.assignedToId === user.id) {
      return { allowed: true };
    }
    if (ticket.subOwnerId === user.id) {
      return { allowed: true };
    }
    if (ticket.createdById === user.id) {
      return { allowed: true };
    }

    // Check if service person has an accepted activity schedule for this ticket
    try {
      const hasActivitySchedule = await prisma.activitySchedule.findFirst({
        where: {
          ticketId: ticketId,
          servicePersonId: user.id,
          status: 'ACCEPTED'
        }
      });
      if (hasActivitySchedule) {
        return { allowed: true };
      }
    } catch (error) {
      // If activity schedule check fails, continue with other checks
    }
  }

  // External user can access tickets they created (after-hours support)
  if (user.role === UserRoleEnum.EXTERNAL_USER) {
    if (ticket.createdById === user.id) {
      return { allowed: true };
    }
    return { allowed: false, error: 'You only have access to tickets you created' };
  }

  // Owner can access their own tickets
  if (ticket.ownerId === user.id || ticket.subOwnerId === user.id) {
    return { allowed: true };
  }
  return { allowed: false, error: 'You do not have permission to access this resource' };
}

// Create a new ticket (Service Coordinator workflow)
export const createTicket = async (req: TicketRequest, res: Response) => {
  try {
    const {
      title,
      description,
      priority = 'MEDIUM',
      callType,
      customerId,
      assetId,
      contactId,
      zoneId,
      errorDetails,
      proofImages,
      relatedMachineIds
    } = req.body;

    const user = req.user as any;

    if (!title || !description || !zoneId) {
      return res.status(400).json({
        error: 'Title, description, and zone are required'
      });
    }

    // Validate callType if provided
    if (callType && !['UNDER_MAINTENANCE_CONTRACT', 'NOT_UNDER_CONTRACT'].includes(callType)) {
      return res.status(400).json({
        error: 'Invalid call type. Must be UNDER_MAINTENANCE_CONTRACT or NOT_UNDER_CONTRACT'
      });
    }

    // Validate zone access for non-admin users
    if ((user.role === UserRoleEnum.ZONE_USER || user.role === UserRoleEnum.ZONE_MANAGER) && user.zoneIds && !user.zoneIds.includes(zoneId)) {
      return res.status(403).json({
        error: 'You can only create tickets in your assigned zone'
      });
    }

    // Generate the next ticket number (starting from 1001)
    const lastTicket = await prisma.ticket.findFirst({
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true }
    });
    const nextTicketNumber = lastTicket?.ticketNumber ? lastTicket.ticketNumber + 1 : 1001;

    // Use TicketUncheckedCreateInput to pass assetId directly
    const ticketData = {
      title,
      description,
      ticketNumber: nextTicketNumber,
      priority: priority as Priority,
      callType: callType || null,
      // Auto-assign and set appropriate status for service person created tickets
      status: user.role === UserRoleEnum.SERVICE_PERSON ? TicketStatus.ASSIGNED : TicketStatus.OPEN,
      customerId: customerId || user.customerId,
      contactId: contactId,
      assetId: assetId, // Required field - must be provided
      createdById: user.id,
      ownerId: user.id,
      // Auto-assign ticket to service person who created it
      assignedToId: user.role === UserRoleEnum.SERVICE_PERSON ? user.id : null,
      zoneId: zoneId,
      errorDetails,
      proofImages: proofImages ? JSON.stringify(proofImages) : undefined,
      relatedMachineIds: relatedMachineIds ? JSON.stringify(relatedMachineIds) : undefined,
      lastStatusChange: new Date(),
    };

    const ticket = await prisma.ticket.create({
      data: ticketData,
      include: {
        customer: { select: { id: true, companyName: true } },
        asset: { select: { id: true, model: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        zone: { select: { id: true, name: true } }
      }
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'TICKET_CREATED',
        entityType: 'TICKET',
        entityId: ticket.id,
        userId: user.id,
        metadata: {
          status: ticket.status,
          title: ticket.title
        },
        updatedAt: new Date(), // Add this required field
        performedAt: new Date(), // It's good practice to include this too
        performedById: user.id, // Include the performer
      }
    });

    // Create initial status history entry for service person created tickets
    if (user.role === UserRoleEnum.SERVICE_PERSON) {
      await prisma.ticketStatusHistory.create({
        data: {
          ticket: { connect: { id: ticket.id } },
          status: TicketStatus.ASSIGNED,
          changedBy: { connect: { id: user.id } },
          changedAt: new Date(),
          notes: 'Ticket automatically assigned to creator (service person)',
          timeInStatus: 0,
          totalTimeOpen: 0,
        },
      });
    }

    // Send WhatsApp notification for OPEN status - non-blocking
    try {
      const ticketNotificationService = new TicketNotificationService();

      // Format phone number to ensure international format
      let customerPhone = ticket.contact?.phone || '';
      if (customerPhone && !customerPhone.startsWith('+')) {
        // Add India country code as default
        customerPhone = '+91' + customerPhone.replace(/[^0-9]/g, '');
      }

      // Execute without await to avoid blocking the response
      ticketNotificationService.sendTicketOpenedNotification({
        id: ticket.id.toString(),
        title: ticket.title,
        customerName: ticket.customer.companyName,
        customerPhone: customerPhone,
        customerId: ticket.customerId.toString(),
        priority: ticket.priority,
        assignedTo: ticket.assignedToId?.toString(),
        estimatedResolution: ticket.dueDate || undefined
      }).catch(err => {

      });
    } catch (notificationError) {
      // Don't fail the ticket creation if notification fails
    }

    return res.status(201).json(ticket);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to create ticket',
      details: error?.message || 'Unknown error occurred'
    });
  }
};

// Get tickets with role-based filtering
export const getTickets = async (req: TicketRequest, res: Response) => {
  try {
    const { status, priority, page = 1, limit = 20, view, search } = req.query;
    const user = req.user as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    // Role-based filtering for non-admin users
    if (user.role !== UserRoleEnum.ADMIN) {
      if (user.role === 'EXPERT_HELPDESK') {
        // Expert helpdesk users only see tickets assigned to themselves
        // This takes precedence over view filters
        where.assignedToId = user.id;
      } else if (user.role === UserRoleEnum.ZONE_USER || user.role === UserRoleEnum.ZONE_MANAGER) {
        // Zone users and zone managers only see tickets assigned to them
        // They must be the assignedTo user
        where.assignedToId = user.id;
      } else if (user.role === UserRoleEnum.SERVICE_PERSON) {
        // Service persons can see tickets assigned to them OR created by them
        if (!where.AND) where.AND = [];
        where.AND.push({
          OR: [
            { assignedToId: user.id },
            { createdById: user.id },
            { ownerId: user.id }
          ]
        });
      } else if (user.role === UserRoleEnum.EXTERNAL_USER) {
        // External users (after-hours support) only see tickets they created
        where.createdById = user.id;
      }
    } else {
      // Admin users can use view filters
      // View-based filtering
      if (view === 'unassigned') {
        // Unassigned means no assignedTo
        where.assignedToId = null;
      } else if (view === 'assigned-to-zone') {
        // Zone Users are now stored in assignedTo
        where.AND = [
          {
            assignedToId: {
              not: null
            }
          },
          {
            assignedTo: {
              role: UserRoleEnum.ZONE_USER
            }
          }
        ];
      } else if (view === 'assigned-to-service-person') {
        where.AND = [
          {
            assignedToId: {
              not: null
            }
          },
          {
            assignedTo: {
              role: UserRoleEnum.SERVICE_PERSON
            }
          }
        ];
      } else if (view === 'assigned-to-zone-manager') {
        // Zone Managers are now stored in assignedTo
        where.AND = [
          {
            assignedToId: {
              not: null
            }
          },
          {
            assignedTo: {
              role: UserRoleEnum.ZONE_MANAGER
            }
          }
        ];
      } else if (view === 'assigned-to-expert-helpdesk') {
        where.AND = [
          {
            assignedToId: {
              not: null
            }
          },
          {
            assignedTo: {
              role: 'EXPERT_HELPDESK'
            }
          }
        ];
      }
    }

    if (status) where.status = { in: (status as string).split(',') };
    if (priority) where.priority = priority;
    if (search) {
      if (!where.AND) where.AND = [];
      where.AND.push({
        OR: [
          { title: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
          { id: { equals: isNaN(Number(search)) ? undefined : Number(search) } }
        ]
      });
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          assignmentStatus: true,
          createdAt: true,
          assetId: true,
          customer: {
            select: {
              id: true,
              companyName: true,
              address: true
            }
          },
          asset: {
            select: {
              id: true,
              model: true,
              serialNo: true
            }
          },
          zone: {
            select: {
              id: true,
              name: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      }),
      prisma.ticket.count({ where })
    ]);

    return res.json({
      data: tickets,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

// Get ticket by ID with full details
export const getTicket = async (req: TicketRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as any; // Type assertion as we know the user will be defined due to auth middleware

    const permission = await checkTicketAccess(user, Number(id));
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.error });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(id) },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
            address: true,
            serviceZone: {
              select: { id: true, name: true }
            }
          }
        },
        asset: {
          select: {
            id: true,
            machineId: true,
            model: true,
            serialNo: true,
            location: true,
            status: true
          }
        },
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true
          }
        },
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true
          }
        },
        subOwner: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true
          }
        },
        zone: {
          select: {
            id: true,
            name: true
          }
        },
        statusHistory: {
          include: {
            changedBy: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          },
          orderBy: { changedAt: 'desc' },
          take: 10
        },
        notes: {
          include: {
            author: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        attachments: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        },
        poRequests: {
          include: {
            requestedBy: {
              select: {
                id: true,
                email: true,
                name: true
              }
            },
            approvedBy: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    return res.json(ticket);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch ticket' });
  }
};

// Update ticket status with history recording
export const updateStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, comments, location: locationDataInput, photos } = req.body;
    const locationData = locationDataInput as any;
    const user = req.user as any;

    const ticketId = Number(id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: 'Invalid ticket ID' });
    }

    const permission = await checkTicketAccess(user, ticketId);
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.error });
    }

    if (!Object.values(TicketStatus).includes(status as any)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Fetch current ticket to compute time tracking
    const currentTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!currentTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const { timeInStatus, totalTimeOpen } = updateTimeTracking(currentTicket);

    // Prepare update data with status and timestamps
    const updateData: any = {
      status,
      lastStatusChange: new Date(),
      timeInStatus,
      totalTimeOpen
    };

    // Add resolvedAt timestamp if status is RESOLVED
    if (status === 'RESOLVED') {
      updateData.resolvedAt = new Date();
    }

    // Add location data for onsite visit statuses
    if (locationData) {
      const locationDataJson = JSON.stringify({
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address,
        timestamp: locationData.timestamp
      });

      switch (status) {
        case 'ONSITE_VISIT_STARTED':
          updateData.visitStartedAt = new Date();
          updateData.onsiteStartLocation = locationDataJson;
          break;
        case 'ONSITE_VISIT_REACHED':
          updateData.visitReachedAt = new Date();
          break;
        case 'ONSITE_VISIT_IN_PROGRESS':
          updateData.visitInProgressAt = new Date();
          break;
        case 'ONSITE_VISIT_RESOLVED':
          updateData.visitResolvedAt = new Date();
          break;
        case 'ONSITE_VISIT_COMPLETED':
          updateData.visitCompletedDate = new Date();
          updateData.onsiteEndLocation = locationDataJson;
          break;
      }

      // Update location history
      if (currentTicket.onsiteLocationHistory) {
        try {
          const locationHistory = JSON.parse(currentTicket.onsiteLocationHistory);
          if (Array.isArray(locationHistory)) {
            locationHistory.push({
              status,
              location: {
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                address: locationData.address,
                timestamp: locationData.timestamp
              }
            });
            updateData.onsiteLocationHistory = JSON.stringify(locationHistory);
          }
        } catch (e) {
          // If parse fails, start a new history
          updateData.onsiteLocationHistory = JSON.stringify([{
            status,
            location: {
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              address: locationData.address,
              timestamp: locationData.timestamp
            }
          }]);
        }
      } else {
        updateData.onsiteLocationHistory = JSON.stringify([{
          status,
          location: {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            address: locationData.address,
            timestamp: locationData.timestamp
          }
        }]);
      }
    }

    // Handle photo data for onsite visit statuses - now store permanently in local storage
    let photoInfo = '';
    let storedPhotos: any[] = [];

    if (photos && photos.photos && photos.photos.length > 0) {
      try {
        // Store photos permanently in local storage
        storedPhotos = await LocalPhotoStorageService.storePhotos(
          photos.photos,
          {
            ticketId: Number(id),
            userId: user.id,
            type: 'ticket'
          }
        );

        const photoCount = storedPhotos.length;
        const totalSize = storedPhotos.reduce((sum: number, photo: any) => sum + photo.size, 0);
        const formattedSize = totalSize > 1024 * 1024
          ? `${(totalSize / (1024 * 1024)).toFixed(1)}MB`
          : `${Math.round(totalSize / 1024)}KB`;

        // Store photo info in notes but NOT the URLs (to avoid duplication)
        // Photos will be fetched via the /photos API endpoint
        const urlList = storedPhotos.map(p => p.url).join(', ');
        photoInfo = `\n\n📸 Photos: ${photoCount} verification photo${photoCount > 1 ? 's' : ''} stored permanently (${formattedSize})\n🕒 Photo Time: ${new Date().toISOString()}\n🔗 Local URLs: ${urlList}`;

        // Log photo storage for audit trail
      } catch (error) {
        // Fallback to metadata-only approach
        const photoCount = photos.photos.length;
        const totalSize = photos.photos.reduce((sum: number, photo: any) => sum + photo.size, 0);
        const formattedSize = totalSize > 1024 * 1024
          ? `${(totalSize / (1024 * 1024)).toFixed(1)}MB`
          : `${Math.round(totalSize / 1024)}KB`;

        photoInfo = `\n\n📸 Photos: ${photoCount} verification photo${photoCount > 1 ? 's' : ''} captured (${formattedSize}) - Storage failed, metadata only\n🕒 Photo Time: ${new Date().toISOString()}`;
      }
    }

    // Prepare notes with location information if provided
    let notesWithLocation = comments || '';
    if (locationData) {
      // For manual locations, preserve the user's original input
      // For GPS locations, geocode to get full address
      let resolvedAddress = locationData.address || 'Unknown';

      if (locationData.source === 'manual' && locationData.address) {
        // Manual address - preserve as-is
        resolvedAddress = locationData.address;
      } else if (locationData.latitude && locationData.longitude) {
        // GPS location - geocode to get full address
        try {
          const { address: geocodedAddress } = await GeocodingService.reverseGeocode(locationData.latitude, locationData.longitude);
          resolvedAddress = geocodedAddress || `${locationData.latitude}, ${locationData.longitude}`;
        } catch (error) {
          // Fallback to provided address or coordinates
          resolvedAddress = locationData.address || `${locationData.latitude}, ${locationData.longitude}`;
        }
      }

      const sourceIndicator = locationData.source === 'manual' ? '✓ Manual' : locationData.accuracy && locationData.accuracy <= 100 ? `✓ Accurate (${locationData.accuracy.toFixed(0)}m)` : locationData.accuracy ? `⚠ Low Accuracy (${locationData.accuracy.toFixed(0)}m)` : '';
      const locationInfo = `\n\n📍 Location: ${resolvedAddress}\n🕒 Time: ${new Date(locationData.timestamp).toLocaleString()}\n📍 Coordinates: ${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}${sourceIndicator ? `\n📌 Source: ${sourceIndicator}` : ''}`;
      notesWithLocation = notesWithLocation + locationInfo;
    }

    // Add photo information to notes
    if (photoInfo) {
      notesWithLocation = notesWithLocation + photoInfo;
    }

    // Insert a new record into TicketStatusHistory with location data
    // Only save location if it's manual or has good accuracy (≤100m)
    const shouldSaveLocation = locationData && (
      locationData.source === 'manual' ||
      (locationData.accuracy && locationData.accuracy <= 100)
    );

    // Use transaction for all relevant updates to ensure consistency
    const updatedTicket = await prisma.$transaction(async (tx) => {
      // 1. Update the ticket with new status and timestamps
      const ticket = await tx.ticket.update({
        where: { id: ticketId },
        data: updateData,
      });

      // 2. Insert record into TicketStatusHistory
      await tx.ticketStatusHistory.create({
        data: {
          ticket: { connect: { id: ticketId } },
          status: status as any,
          changedBy: { connect: { id: user.id } },
          changedAt: new Date(),
          notes: notesWithLocation,
          timeInStatus,
          totalTimeOpen,
          ...(shouldSaveLocation && {
            location: locationData.address,
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            accuracy: locationData.accuracy,
            locationSource: locationData.source || 'gps'
          })
        },
      });

      return ticket;
    });

    // Create automatic activity log for ticket status update
    try {
      await ActivityController.logActivity({
        userId: user.id,
        action: `TICKET_STATUS_CHANGED`,
        entityType: 'TICKET',
        entityId: Number(id).toString(),
        details: {
          oldStatus: currentTicket.status,
          newStatus: status,
          ...(locationData && {
            location: locationData.address,
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            accuracy: locationData.accuracy,
            locationSource: locationData.source || 'gps'
          })
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (activityError) {
      // Don't fail the status update if activity logging fails
    }

    // Send WhatsApp notification only for OPEN and CLOSED_PENDING statuses
    try {
      if (status === 'OPEN' || status === 'CLOSED_PENDING') {
        const ticketNotificationService = new TicketNotificationService();

        // Fetch complete ticket data for notification
        const ticketForNotification = await prisma.ticket.findUnique({
          where: { id: Number(id) },
          include: {
            customer: { select: { companyName: true } },
            contact: { select: { phone: true } },
            assignedTo: { select: { name: true } }
          }
        });

        if (ticketForNotification) {
          const notificationData = {
            id: ticketForNotification.id.toString(),
            title: ticketForNotification.title,
            customerName: ticketForNotification.customer.companyName,
            customerPhone: ticketForNotification.contact?.phone || '',
            customerId: ticketForNotification.customerId.toString(),
            oldStatus: currentTicket.status,
            newStatus: status,
            priority: ticketForNotification.priority,
            assignedTo: ticketForNotification.assignedTo?.name || undefined,
            estimatedResolution: ticketForNotification.dueDate || undefined
          };

          if (status === 'OPEN') {
            await ticketNotificationService.sendTicketOpenedNotification({
              id: notificationData.id,
              title: notificationData.title,
              customerName: notificationData.customerName,
              customerPhone: notificationData.customerPhone,
              customerId: notificationData.customerId,
              priority: notificationData.priority,
              assignedTo: notificationData.assignedTo,
              estimatedResolution: notificationData.estimatedResolution
            });
          } else if (status === 'CLOSED_PENDING') {
            await ticketNotificationService.sendTicketPendingNotification({
              id: notificationData.id,
              title: notificationData.title,
              customerName: notificationData.customerName,
              customerPhone: notificationData.customerPhone,
              assignedTo: notificationData.assignedTo
            });
          }
        }
      }
    } catch (notificationError) {
      // Don't fail the status update if notification fails
    }

    return res.json(updatedTicket);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update status' });
  }
};

// Get ticket comments
export const getTicketComments = async (req: TicketRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Ticket ID is required' });
    }

    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return res.status(400).json({ message: 'Invalid ticket ID' });
    }

    // Check if ticket exists and user has access
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        customer: true,
        zone: true,
        assignedTo: true,
      },
    });

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const hasAccess = await checkTicketAccess(req.user, ticketId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const comments = await prisma.comment.findMany({
      where: { ticketId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            customer: {
              select: {
                companyName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform comments to match frontend expected format
    const transformedComments = comments.map(comment => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      user: {
        id: comment.user.id,
        name: comment.user.customer?.companyName || comment.user.email,
        email: comment.user.email,
      },
    }));

    res.json(transformedComments);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Add comment to ticket
export const addTicketComment = async (req: TicketRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Ticket ID is required' });
    }

    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return res.status(400).json({ message: 'Invalid ticket ID' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    // Check if ticket exists and user has access
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const hasAccess = await checkTicketAccess(req.user, ticketId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Create the comment
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        ticketId,
        userId: req.user!.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            customer: {
              select: {
                companyName: true,
              },
            },
          },
        },
      },
    });

    // Transform comment to match frontend expected format
    const transformedComment = {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      user: {
        id: comment.user.id,
        name: comment.user.customer?.companyName || comment.user.email,
        email: comment.user.email,
      },
    };

    res.status(201).json(transformedComment);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Assign ticket to service person or expert helpdesk
export const assignTicket = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { assignedToId, subOwnerId, note } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!assignedToId) {
      return res.status(400).json({ error: 'assignedToId is required' });
    }

    // Check if the ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(ticketId) },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check if the assigned user exists and is either a service person or expert helpdesk
    const assignedUser = await prisma.user.findUnique({
      where: {
        id: Number(assignedToId),
      },
    });

    if (!assignedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate that the user is a valid assignee role
    const validAssigneeRoles = ['SERVICE_PERSON', 'EXPERT_HELPDESK', 'ZONE_USER', 'ZONE_MANAGER'];
    if (!assignedUser.role || !validAssigneeRoles.includes(assignedUser.role)) {
      return res.status(400).json({ error: `Can only assign to: ${validAssigneeRoles.join(', ')}` });
    }

    // Use transaction for atomicity
    const updatedTicket = await prisma.$transaction(async (tx) => {
      // 1. Update the ticket with the new assignee
      const ticket = await tx.ticket.update({
        where: { id: Number(ticketId) },
        data: {
          assignedToId: Number(assignedToId),
          ...(subOwnerId && { subOwnerId: Number(subOwnerId) }),
          status: TicketStatus.ASSIGNED,
          lastStatusChange: new Date(),
          assignmentStatus: 'PENDING',
          assignmentRespondedAt: null,
          assignmentNotes: null,
        },
        include: {
          assignedTo: {
            select: { id: true, email: true, name: true, role: true, phone: true },
          },
          subOwner: {
            select: { id: true, email: true, name: true, role: true },
          },
        },
      });

      // 2. Create status history entry
      await tx.ticketStatusHistory.create({
        data: {
          ticketId: ticket.id,
          status: ticket.status,
          changedById: user.id,
          notes: note || `Ticket assigned to ${ticket.assignedTo?.name || 'service person'}`
        }
      });

      // 3. Create audit log
      await tx.auditLog.create({
        data: {
          action: 'ASSIGN_TO_SERVICE_PERSON',
          entityType: 'TICKET',
          entityId: Number(ticketId),
          userId: user.id,
          performedById: user.id,
          details: note || `Assigned ticket to service person ${assignedUser.name}`,
          updatedAt: new Date()
        }
      });

      return ticket;
    });

    // Send notification to assigned user
    await NotificationService.createTicketAssignmentNotification(
      updatedTicket.id,
      Number(assignedToId),
      user.id
    );

    // Send WhatsApp notification to assigned service person
    try {
      const ticketNotificationService = new TicketNotificationService();

      // Get customer details for the notification
      const customerDetails = await prisma.customer.findUnique({
        where: { id: updatedTicket.customerId },
        select: { companyName: true }
      });
      if (assignedUser.phone && customerDetails && assignedUser.name) {
        await ticketNotificationService.sendTicketAssignedNotification({
          id: updatedTicket.id.toString(),
          title: updatedTicket.title,
          customerName: customerDetails.companyName,
          assignedToName: assignedUser.name,
          assignedToPhone: assignedUser.phone,
          priority: updatedTicket.priority as any,
          estimatedResolution: updatedTicket.dueDate || undefined
        });
      } else {
      }
    } catch (whatsappError) {
      // Don't throw error to avoid disrupting the main assignment flow
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'ASSIGN_TO_SERVICE_PERSON',
        entityType: 'TICKET',
        entityId: Number(ticketId),
        userId: user.id,
        performedById: user.id,
        details: note || `Assigned ticket to service person ${assignedUser.name}`,
        updatedAt: new Date()
      }
    });

    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: 'Error assigning ticket' });
  }
};

// Plan onsite visit
export const planOnsiteVisit = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { servicePersonId, visitDate, notes } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify service person exists and is active
    const servicePerson = await prisma.user.findFirst({
      where: {
        id: Number(servicePersonId),
        role: UserRoleEnum.SERVICE_PERSON,
        isActive: true
      }
    });

    if (!servicePerson) {
      return res.status(404).json({ error: 'Service person not found or inactive' });
    }

    // Update ticket with onsite visit details
    const updatedTicket = await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        assignedToId: Number(servicePersonId),
        status: TicketStatus.ONSITE_VISIT_PLANNED,
        // onsiteVisitDate: new Date(visitDate), // Field may not exist in schema
        lastStatusChange: new Date(),
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Create status history
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: Number(ticketId),
        status: TicketStatus.ONSITE_VISIT_PLANNED,
        changedById: user.id,
        notes: notes || `Onsite visit planned for ${visitDate}`
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'PLAN_ONSITE_VISIT',
        entityType: 'TICKET',
        entityId: Number(ticketId),
        userId: user.id,
        performedById: user.id,
        details: `Planned onsite visit for ${visitDate}`,
        updatedAt: new Date()
      }
    });

    // Send onsite visit notification
    if (updatedTicket.assignedToId) {
      await NotificationService.createOnsiteVisitNotification(
        Number(ticketId),
        updatedTicket.assignedToId,
        new Date(visitDate),
        user.id
      );
    }

    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: 'Error planning onsite visit' });
  }
};

// Assign ticket to zone user for onsite visit
export const assignToZoneUser = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { zoneUserId } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!zoneUserId) {
      return res.status(400).json({ error: 'zoneUserId is required' });
    }

    // Verify zone user exists (can be either ZONE_USER or ZONE_MANAGER)
    const zoneUser = await prisma.user.findUnique({
      where: {
        id: Number(zoneUserId),
      },
    });

    if (!zoneUser) {
      return res.status(404).json({ error: 'Zone user not found' });
    }

    // Validate that the user is a zone user or zone manager
    if (zoneUser.role !== 'ZONE_USER' && zoneUser.role !== 'ZONE_MANAGER') {
      return res.status(400).json({ error: 'User must be a Zone User or Zone Manager' });
    }

    // First get the current ticket to preserve its status
    const currentTicket = await prisma.ticket.findUnique({
      where: { id: Number(ticketId) },
      select: { status: true, assignedToId: true }
    });

    if (!currentTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Update assignedToId (same as other roles for consistency)
    const updatedTicket = await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        assignedToId: Number(zoneUserId),
        status: currentTicket.status, // Explicitly set to current status
        lastStatusChange: new Date(),
        // Set assignment status to PENDING so assigned user can accept/reject
        assignmentStatus: 'PENDING',
        assignmentRespondedAt: null,
        assignmentNotes: null,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        subOwner: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    // Create status history entry for the assignment
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: updatedTicket.id,
        status: currentTicket.status,
        changedById: user.id,
        notes: `Assigned to zone user: ${updatedTicket.assignedTo?.name || 'zone user'}`,
        timeInStatus: null,
        totalTimeOpen: null
      }
    });

    // Send notification to assigned user
    await NotificationService.createTicketAssignmentNotification(
      updatedTicket.id,
      Number(zoneUserId),
      user.id
    );

    // Send WhatsApp notification to assigned zone user
    try {
      const ticketNotificationService = new TicketNotificationService();

      // Get customer details for the notification
      const customerDetails = await prisma.customer.findUnique({
        where: { id: updatedTicket.customerId },
        select: { companyName: true }
      });
      if (zoneUser.phone && customerDetails && zoneUser.name) {
        await ticketNotificationService.sendTicketAssignedNotification({
          id: updatedTicket.id.toString(),
          title: updatedTicket.title,
          customerName: customerDetails.companyName,
          assignedToName: zoneUser.name,
          assignedToPhone: zoneUser.phone,
          priority: updatedTicket.priority as any,
          estimatedResolution: updatedTicket.dueDate || undefined
        });
      } else {
      }
    } catch (whatsappError) {
      // Don't throw error to avoid disrupting the main assignment flow
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'ASSIGN_TO_ZONE_USER',
        entityType: 'TICKET',
        entityId: Number(ticketId),
        userId: user.id,
        performedById: user.id,
        details: `Assigned ticket to zone user ${zoneUser.name}`,
        updatedAt: new Date()
      }
    });

    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: 'Error assigning to zone user' });
  }
};

// Complete onsite visit
export const completeOnsiteVisit = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { resolutionSummary, isResolved, sparePartsNeeded, sparePartsDetails } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let newStatus: TicketStatus;

    if (isResolved) {
      newStatus = TicketStatus.RESOLVED;
    } else if (sparePartsNeeded) {
      newStatus = TicketStatus.SPARE_PARTS_NEEDED;
    } else {
      newStatus = TicketStatus.IN_PROGRESS;
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        visitCompletedDate: new Date(),
        resolutionSummary,
        ...(sparePartsDetails && { sparePartsDetails: JSON.stringify(sparePartsDetails) }),
        status: newStatus,
        lastStatusChange: new Date(),
      },
    });

    // Create status history entry
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: Number(ticketId),
        status: newStatus,
        changedById: user.id,
        notes: req.body.notes || `Status changed to ${newStatus}`
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_SPARE_PARTS_STATUS',
        entityType: 'TICKET',
        entityId: Number(ticketId),
        userId: user.id,
        performedById: user.id,
        details: `Updated spare parts status to ${sparePartsNeeded ? 'NEEDED' : 'NOT_NEEDED'}`,
        updatedAt: new Date()
      }
    });

    // Send spare parts notification only if needed
    if (sparePartsNeeded) {
      await NotificationService.createSparePartsNotification(
        Number(ticketId),
        'NEEDED',
        user.id
      );
    }

    // Send status change notification
    await NotificationService.createTicketStatusNotification(
      Number(ticketId),
      TicketStatus.ONSITE_VISIT,
      newStatus,
      user.id
    );

    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: 'Error completing onsite visit' });
  }
};

// Request PO for spare parts
export const requestPO = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { amount, description, notes } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Create PO request
    const poRequest = await prisma.pORequest.create({
      data: {
        ticketId: Number(ticketId),
        amount: amount ? parseFloat(amount) : undefined,
        description,
        notes,
        requestedById: user.id,
        status: 'PENDING',
      },
    });

    // Update ticket status
    const updatedTicket = await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        status: TicketStatus.PO_NEEDED,
        lastStatusChange: new Date(),
      },
    });

    // Create status history entry
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: Number(ticketId),
        status: TicketStatus.PO_NEEDED,
        changedById: user.id,
        notes: `PO requested: ${description}`,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'CREATE_PO_REQUEST',
        entityType: 'PO_REQUEST',
        entityId: poRequest.id,
        userId: user.id,
        performedById: user.id,
        details: `Created PO request: ${description}`,
        updatedAt: new Date()
      }
    });

    // Send PO creation notification
    await NotificationService.createPONotification(
      Number(ticketId),
      poRequest.id,
      'CREATED',
      user.id
    );

    res.json({ ticket: updatedTicket, poRequest });
  } catch (error) {
    res.status(500).json({ error: 'Error requesting PO' });
  }
};

// Approve PO
export const approvePO = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { poNumber, notes } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Only admins can approve POs
    if (user.role !== UserRoleEnum.ADMIN) {
      return res.status(403).json({ error: 'Only admins can approve POs' });
    }

    // Update PO request
    await prisma.pORequest.updateMany({
      where: { ticketId: Number(ticketId) },
      data: {
        status: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
        notes,
      },
    });

    // Update ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        poNumber,
        poApprovedAt: new Date(),
        poApprovedById: user.id,
        status: TicketStatus.PO_RECEIVED,
        lastStatusChange: new Date(),
      },
    });

    // Create status history entry
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: Number(ticketId),
        status: TicketStatus.PO_RECEIVED,
        changedById: user.id,
        notes: `PO approved: ${poNumber}`,
      },
    });

    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: 'Error approving PO' });
  }
};

// Update spare parts status
export const updateSparePartsStatus = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { status: sparePartsStatus, details } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let newTicketStatus: TicketStatus;

    switch (sparePartsStatus) {
      case 'BOOKED':
        newTicketStatus = TicketStatus.SPARE_PARTS_BOOKED;
        break;
      case 'DELIVERED':
        newTicketStatus = TicketStatus.SPARE_PARTS_DELIVERED;
        break;
      default:
        return res.status(400).json({ error: 'Invalid spare parts status' });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        status: newTicketStatus,
        sparePartsDetails: details ? JSON.stringify(details) : undefined,
        lastStatusChange: new Date(),
      },
    });

    // Create status history entry
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: Number(ticketId),
        status: newTicketStatus,
        changedById: user.id,
        notes: `Spare parts ${sparePartsStatus.toLowerCase()}`,
      },
    });

    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: 'Error updating spare parts status' });
  }
};

// Close ticket (Zone Owner closes after resolution)
export const closeTicket = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { feedback, rating } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Use transaction for consistency
    const updatedTicket = await prisma.$transaction(async (tx) => {
      // 1. Update to CLOSED status (skip PENDING if it was redundant)
      const ticket = await tx.ticket.update({
        where: { id: Number(ticketId) },
        data: {
          status: TicketStatus.CLOSED,
          lastStatusChange: new Date(),
        },
      });

      // 2. Create feedback if provided
      if (feedback || rating) {
        await tx.ticketFeedback.create({
          data: {
            ticketId: Number(ticketId),
            feedback,
            rating: rating || 5,
            submittedById: user.id,
          },
        });
      }

      // 3. Create status history entry for CLOSED
      await tx.ticketStatusHistory.create({
        data: {
          ticketId: Number(ticketId),
          status: TicketStatus.CLOSED,
          changedById: user.id,
          notes: 'Ticket closed by zone owner',
        },
      });

      return ticket;
    });

    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: 'Error closing ticket' });
  }
};

// Get ticket activity log
export const getTicketActivity = async (req: TicketRequest, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id || '', 10);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: 'Invalid ticket ID' });
    }

    // Check if user has access to this ticket
    const hasAccess = await checkTicketAccess(req.user, ticketId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get ticket status history, notes, scheduled activities, reports, and audit logs
    const [statusHistory, notes, scheduledActivities, reports, auditLogs] = await Promise.all([
      prisma.ticketStatusHistory.findMany({
        where: { ticketId },
        orderBy: { changedAt: 'desc' },
        select: {
          id: true,
          status: true,
          changedAt: true,
          notes: true,
          location: true,
          latitude: true,
          longitude: true,
          accuracy: true,
          locationSource: true,
          changedBy: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true
            }
          }
        }
      }),
      prisma.ticketNote.findMany({
        where: { ticketId },
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true
            }
          }
        }
      }),
      // Fetch scheduled activities for this ticket
      prisma.activitySchedule.findMany({
        where: { ticketId },
        orderBy: { createdAt: 'desc' },
        include: {
          servicePerson: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true
            }
          },
          scheduledBy: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true
            }
          }
        }
      }),
      // Fetch reports for this ticket
      prisma.ticketReport.findMany({
        where: { ticketId },
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true
            }
          }
        }
      }),
      // Fetch audit logs for this ticket
      prisma.auditLog.findMany({
        where: {
          OR: [
            { ticketId },
            { entityType: 'TICKET', entityId: ticketId }
          ]
        },
        orderBy: { createdAt: 'desc' },
        include: {
          performedBy: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true
            }
          }
        }
      })
    ]);

    // Define activity type
    type Activity = {
      id: string;
      type: 'STATUS_CHANGE' | 'NOTE' | 'SCHEDULED' | 'REPORT_UPLOADED' | 'TICKET_CREATED' | 'TICKET_UPDATED' | 'TICKET_ASSIGNED' | 'AUDIT';
      description: string;
      data: Record<string, any>;
      user: { id: number; email: string; name: string | null; role: string | null };
      createdAt: Date;
      updatedAt: Date;
    };

    // Combine and sort activities
    const activities: Activity[] = [
      ...statusHistory.map((history: any) => ({
        id: `status_${history.id}`,
        type: 'STATUS_CHANGE' as const,
        description: history.notes && history.notes.includes('assigned to') || history.notes && history.notes.includes('Assigned to')
          ? history.notes
          : `Changed status to ${history.status.replace(/_/g, ' ')}`,
        data: {
          status: history.status,
          notes: history.notes,
          location: history.location,
          latitude: history.latitude,
          longitude: history.longitude,
          accuracy: history.accuracy,
          locationSource: history.locationSource
        },
        user: {
          ...history.changedBy,
          name: history.changedBy.name || history.changedBy.email.split('@')[0] // Use email prefix if name is not available
        },
        createdAt: history.changedAt,
        updatedAt: history.changedAt
      })),
      ...notes.map((note: { id: number; content: string; author: { id: number; email: string; name: string | null; role: string | null }; createdAt: Date; updatedAt: Date }) => ({
        id: `note_${note.id}`,
        type: 'NOTE' as const,
        description: 'Note added',
        data: { content: note.content },
        user: {
          ...note.author,
          name: note.author.name || note.author.email.split('@')[0] // Use email prefix if name is not available
        },
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
      })),
      // Add scheduled activities to timeline
      ...scheduledActivities.map((schedule: any) => ({
        id: `schedule_${schedule.id}`,
        type: 'SCHEDULED' as const,
        description: `Scheduled ${schedule.activityType.toLowerCase().replace(/_/g, ' ')} to ${schedule.servicePerson.name || schedule.servicePerson.email.split('@')[0]}`,
        data: {
          activityType: schedule.activityType,
          scheduledDate: schedule.scheduledDate,
          status: schedule.status,
          priority: schedule.priority,
          estimatedDuration: schedule.estimatedDuration,
          location: schedule.location,
          notes: schedule.notes,
          servicePerson: {
            id: schedule.servicePerson.id,
            name: schedule.servicePerson.name || schedule.servicePerson.email.split('@')[0],
            email: schedule.servicePerson.email,
            role: schedule.servicePerson.role
          },
          acceptedAt: schedule.acceptedAt,
          rejectedAt: schedule.rejectedAt,
          rejectionReason: schedule.rejectionReason,
          completedAt: schedule.completedAt
        },
        user: {
          ...schedule.scheduledBy,
          name: schedule.scheduledBy.name || schedule.scheduledBy.email.split('@')[0]
        },
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt
      })),
      // Add report uploads to timeline
      ...reports.map((report: any) => ({
        id: `report_${report.id}`,
        type: 'REPORT_UPLOADED' as const,
        description: `Report uploaded: ${report.fileName}`,
        data: {
          fileName: report.fileName,
          fileSize: report.fileSize,
          fileType: report.fileType,
          reportId: report.id
        },
        user: {
          ...report.uploadedBy,
          name: report.uploadedBy.name || report.uploadedBy.email.split('@')[0]
        },
        createdAt: report.createdAt,
        updatedAt: report.updatedAt || report.createdAt
      })),
      // Add audit logs to timeline (filter out duplicates with status history)
      ...auditLogs
        .filter((log: any) => {
          // Exclude status change audit logs as they're already in statusHistory
          return !['STATUS_CHANGED', 'TICKET_STATUS_CHANGED'].includes(log.action);
        })
        .map((log: any) => {
          // Map action to user-friendly description
          const getActionDescription = (action: string, details: any) => {
            switch (action) {
              case 'TICKET_CREATED':
                return `Ticket created: ${details?.title || 'New ticket'}`;
              case 'TICKET_UPDATED':
                return 'Ticket details updated';
              case 'TICKET_ASSIGNED':
                return `Ticket assigned to ${details?.assigneeName || 'user'}`;
              case 'TICKET_ESCALATED':
                return `Ticket escalated${details?.reason ? ': ' + details.reason : ''}`;
              case 'TICKET_CLOSED':
                return 'Ticket closed';
              case 'TICKET_REOPENED':
                return 'Ticket reopened';
              case 'PO_REQUESTED':
                return 'PO requested';
              case 'PO_APPROVED':
                return `PO approved: ${details?.poNumber || ''}`;
              case 'COMMENT_ADDED':
                return 'Comment added';
              default:
                return action.replace(/_/g, ' ').toLowerCase().replace(/^./, (s: string) => s.toUpperCase());
            }
          };

          return {
            id: `audit_${log.id}`,
            type: log.action as any,
            description: getActionDescription(log.action, log.details || log.metadata),
            data: {
              action: log.action,
              details: log.details,
              metadata: log.metadata,
              oldValue: log.oldValue,
              newValue: log.newValue,
              ipAddress: log.ipAddress,
              userAgent: log.userAgent
            },
            user: log.performedBy ? {
              ...log.performedBy,
              name: log.performedBy.name || log.performedBy.email?.split('@')[0] || 'System'
            } : {
              id: log.userId || 0,
              email: 'system@kardex.com',
              name: 'System',
              role: null
            },
            createdAt: log.createdAt,
            updatedAt: log.updatedAt || log.createdAt
          };
        })
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Add note to ticket (internal use)
export const addNote = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { content } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    // Check if ticket exists and user has access
    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(ticketId) },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const hasAccess = await checkTicketAccess(user, Number(ticketId));
    if (!hasAccess.allowed) {
      return res.status(403).json({ error: hasAccess.error });
    }

    // Create the note record
    const note = await prisma.ticketNote.create({
      data: {
        content: content.trim(),
        ticketId: Number(ticketId),
        authorId: user.id
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Update ticket's last status change timestamp
    await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        lastStatusChange: new Date(),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'ADD_NOTE',
        entityType: 'TICKET',
        entityId: Number(ticketId),
        userId: user.id,
        performedById: user.id,
        details: {
          noteId: note.id,
          message: 'Added internal note'
        },
        updatedAt: new Date(),
        performedAt: new Date()
      }
    });

    res.json({ success: true, message: 'Note added successfully', note });
  } catch (error) {
    res.status(500).json({ error: 'Error adding note' });
  }
};

// Upload reports for a ticket
export const uploadTicketReports = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if ticket exists and user has access
    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(ticketId) },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const hasAccess = await checkTicketAccess(user, Number(ticketId));
    if (!hasAccess.allowed) {
      return res.status(403).json({ error: hasAccess.error });
    }

    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = req.files as Express.Multer.File[];
    const uploadedReports = [];

    for (const file of files) {
      // Create report record in database
      const report = await prisma.ticketReport.create({
        data: {
          ticketId: Number(ticketId),
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
          filePath: file.path,
          uploadedById: user.id,
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      uploadedReports.push({
        id: report.id,
        fileName: report.fileName,
        fileSize: report.fileSize,
        fileType: report.fileType,
        uploadedBy: report.uploadedBy.name || report.uploadedBy.email,
        uploadedAt: report.createdAt,
        url: `${process.env.BACKEND_URL || 'http://localhost:5003'}/api/tickets/${ticketId}/reports/${report.id}/download`,
      });

      // Create audit log for report upload
      await prisma.auditLog.create({
        data: {
          action: 'REPORT_UPLOADED',
          entityType: 'TICKET',
          entityId: Number(ticketId),
          userId: user.id,
          performedById: user.id,
          performedAt: new Date(),
          updatedAt: new Date(),
          details: {
            reportId: report.id,
            fileName: report.fileName,
            fileSize: report.fileSize,
            fileType: report.fileType,
            message: `Report "${report.fileName}" uploaded`,
          },
        },
      });
    }

    res.status(201).json(uploadedReports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload reports' });
  }
};

// Get all reports for a ticket
export const getTicketReports = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if ticket exists and user has access
    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(ticketId) },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const hasAccess = await checkTicketAccess(user, Number(ticketId));
    if (!hasAccess.allowed) {
      return res.status(403).json({ error: hasAccess.error });
    }

    const reports = await prisma.ticketReport.findMany({
      where: { ticketId: Number(ticketId) },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const formattedReports = reports.map((report: any) => ({
      id: report.id,
      fileName: report.fileName,
      fileSize: report.fileSize,
      fileType: report.fileType,
      uploadedBy: report.uploadedBy.name || report.uploadedBy.email,
      uploadedAt: report.createdAt,
      url: `${process.env.BACKEND_URL || 'http://localhost:5003'}/api/tickets/${ticketId}/reports/${report.id}/download`,
    }));

    res.json(formattedReports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

// Download a specific report
export const downloadTicketReport = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId, reportId } = req.params;
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if ticket exists and user has access
    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(ticketId) },
      select: {
        id: true,
        customerId: true,
        assignedToId: true,
        zoneId: true,
        ownerId: true,
        subOwnerId: true,
        createdById: true
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const hasAccess = await checkTicketAccess(user, Number(ticketId));
    if (!hasAccess.allowed) {
      return res.status(403).json({ error: hasAccess.error });
    }

    const report = await prisma.ticketReport.findUnique({
      where: { id: Number(reportId) },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.ticketId !== Number(ticketId)) {
      return res.status(403).json({ error: 'Report does not belong to this ticket' });
    }

    const fs = require('fs');
    const path = require('path');

    if (!fs.existsSync(report.filePath)) {
      return res.status(404).json({
        error: 'File not found on server',
        details: 'The uploaded file has been removed or is no longer available. Please contact support if you need this file.'
      });
    }

    res.download(report.filePath, report.fileName);
  } catch (error) {
    // Handle specific file system errors
    if (error && typeof error === 'object' && 'code' in error) {
      const errorCode = (error as any).code;
      if (errorCode === 'ENOENT') {
        return res.status(404).json({
          error: 'File not found on server',
          details: 'The requested file could not be found. It may have been deleted or moved.'
        });
      } else if (errorCode === 'EACCES') {
        return res.status(403).json({
          error: 'Permission denied',
          details: 'Unable to access the requested file due to permission restrictions.'
        });
      }
    }

    res.status(500).json({
      error: 'Failed to download report',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

// Delete a specific report
export const deleteTicketReport = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId, reportId } = req.params;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if ticket exists and user has access
    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(ticketId) },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const hasAccess = await checkTicketAccess(user, Number(ticketId));
    if (!hasAccess.allowed) {
      return res.status(403).json({ error: hasAccess.error });
    }

    const report = await prisma.ticketReport.findUnique({
      where: { id: Number(reportId) },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.ticketId !== Number(ticketId)) {
      return res.status(403).json({ error: 'Report does not belong to this ticket' });
    }

    // Only allow deletion by the uploader or admin
    if (report.uploadedById !== user.id && user.role !== UserRoleEnum.ADMIN) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete file from filesystem
    const fs = require('fs');
    if (fs.existsSync(report.filePath)) {
      fs.unlinkSync(report.filePath);
    }

    // Delete record from database
    await prisma.ticketReport.delete({
      where: { id: Number(reportId) },
    });

    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete report' });
  }
};

// Start onsite visit with location tracking
export const startOnsiteVisit = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { latitude, longitude, address, plannedDate } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Location coordinates are required' });
    }

    const permission = await checkTicketAccess(user, Number(ticketId));
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.error });
    }

    // Update ticket with onsite visit start details
    const updatedTicket = await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        status: TicketStatus.ONSITE_VISIT_STARTED,
        visitStartedAt: new Date(),
        visitPlannedDate: plannedDate ? new Date(plannedDate) : undefined,
        onsiteStartLocation: JSON.stringify({ latitude, longitude, address }),
        lastStatusChange: new Date(),
      },
    });

    // Create onsite visit log entry
    await prisma.onsiteVisitLog.create({
      data: {
        ticketId: Number(ticketId),
        userId: user.id,
        event: OnsiteVisitEvent.STARTED,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || null,
      },
    });

    // Create status history entry
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: Number(ticketId),
        status: TicketStatus.ONSITE_VISIT_STARTED,
        changedById: user.id,
        notes: `Onsite visit started at ${address || 'location'}`,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'ONSITE_VISIT_STARTED',
        entityType: 'TICKET',
        entityId: Number(ticketId),
        userId: user.id,
        performedById: user.id,
        details: `Started onsite visit at ${address || 'location'}`,
        updatedAt: new Date(),
      },
    });

    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start onsite visit' });
  }
};

// Mark onsite visit as reached
export const reachOnsiteLocation = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { latitude, longitude, address } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Location coordinates are required' });
    }

    const permission = await checkTicketAccess(user, Number(ticketId));
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.error });
    }

    // Update ticket status
    const updatedTicket = await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        status: TicketStatus.ONSITE_VISIT_REACHED,
        visitReachedAt: new Date(),
        lastStatusChange: new Date(),
      },
    });

    // Create onsite visit log entry
    await prisma.onsiteVisitLog.create({
      data: {
        ticketId: Number(ticketId),
        userId: user.id,
        event: OnsiteVisitEvent.REACHED,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || null,
      },
    });

    // Create status history entry
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: Number(ticketId),
        status: TicketStatus.ONSITE_VISIT_REACHED,
        changedById: user.id,
        notes: `Reached onsite location at ${address || 'location'}`,
      },
    });

    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update onsite visit reach' });
  }
};

// Start work at onsite location
export const startOnsiteWork = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { latitude, longitude, address, workDescription } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const permission = await checkTicketAccess(user, Number(ticketId));
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.error });
    }

    // Update ticket status
    const updatedTicket = await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        status: TicketStatus.ONSITE_VISIT_IN_PROGRESS,
        visitInProgressAt: new Date(),
        lastStatusChange: new Date(),
      },
    });

    // Create onsite visit log entry
    if (latitude && longitude) {
      await prisma.onsiteVisitLog.create({
        data: {
          ticketId: Number(ticketId),
          userId: user.id,
          event: OnsiteVisitEvent.WORK_STARTED,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          address: address || null,
        },
      });
    }

    // Create status history entry
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: Number(ticketId),
        status: TicketStatus.ONSITE_VISIT_IN_PROGRESS,
        changedById: user.id,
        notes: workDescription || 'Started work at onsite location',
      },
    });

    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start onsite work' });
  }
};

// Resolve onsite visit work
export const resolveOnsiteWork = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { latitude, longitude, address, resolutionSummary, isFullyResolved } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const permission = await checkTicketAccess(user, Number(ticketId));
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.error });
    }

    // Update ticket status
    const updatedTicket = await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        status: TicketStatus.ONSITE_VISIT_RESOLVED,
        visitResolvedAt: new Date(),
        resolutionSummary: resolutionSummary || undefined,
        lastStatusChange: new Date(),
      },
    });

    // Create onsite visit log entry
    if (latitude && longitude) {
      await prisma.onsiteVisitLog.create({
        data: {
          ticketId: Number(ticketId),
          userId: user.id,
          event: OnsiteVisitEvent.RESOLVED,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          address: address || null,
        },
      });
    }

    // Create status history entry
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: Number(ticketId),
        status: TicketStatus.ONSITE_VISIT_RESOLVED,
        changedById: user.id,
        notes: resolutionSummary || 'Onsite work resolved',
      },
    });

    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve onsite work' });
  }
};

// Mark onsite visit as pending
export const markOnsiteVisitPending = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { reason, expectedResolutionDate } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const permission = await checkTicketAccess(user, Number(ticketId));
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.error });
    }

    // Update ticket status
    const updatedTicket = await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        status: TicketStatus.ONSITE_VISIT_PENDING,
        lastStatusChange: new Date(),
      },
    });

    // Create onsite visit log entry
    await prisma.onsiteVisitLog.create({
      data: {
        ticketId: Number(ticketId),
        userId: user.id,
        event: OnsiteVisitEvent.PENDING,
        latitude: 0, // Default values for pending status
        longitude: 0,
        address: reason || 'Onsite visit marked as pending',
      },
    });

    // Create status history entry
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: Number(ticketId),
        status: TicketStatus.ONSITE_VISIT_PENDING,
        changedById: user.id,
        notes: reason || 'Onsite visit marked as pending',
      },
    });

    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark onsite visit as pending' });
  }
};

// Complete onsite visit and return
export const completeOnsiteVisitAndReturn = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { latitude, longitude, address, completionNotes } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const permission = await checkTicketAccess(user, Number(ticketId));
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.error });
    }

    // Update ticket status
    const updatedTicket = await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        status: TicketStatus.ONSITE_VISIT_COMPLETED,
        visitCompletedDate: new Date(),
        onsiteEndLocation: JSON.stringify({ latitude, longitude, address }),
        lastStatusChange: new Date(),
      },
    });

    // Create onsite visit log entries for completion and return
    if (latitude && longitude) {
      await prisma.onsiteVisitLog.create({
        data: {
          ticketId: Number(ticketId),
          userId: user.id,
          event: OnsiteVisitEvent.ENDED,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          address: address || null,
        },
      });

      await prisma.onsiteVisitLog.create({
        data: {
          ticketId: Number(ticketId),
          userId: user.id,
          event: OnsiteVisitEvent.REACHED_BACK,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          address: address || null,
        },
      });
    }

    // Create status history entry
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: Number(ticketId),
        status: TicketStatus.ONSITE_VISIT_COMPLETED,
        changedById: user.id,
        notes: completionNotes || 'Onsite visit completed and returned',
      },
    });

    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete onsite visit' });
  }
};

// Update PO status to reached
export const updatePOReached = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { notes } = req.body;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const permission = await checkTicketAccess(user, Number(ticketId));
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.error });
    }

    // Update ticket status
    const updatedTicket = await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        status: TicketStatus.PO_REACHED,
        poReachedAt: new Date(),
        lastStatusChange: new Date(),
      },
    });

    // Create status history entry
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: Number(ticketId),
        status: TicketStatus.PO_REACHED,
        changedById: user.id,
        notes: notes || 'PO has reached the location',
      },
    });

    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update PO reached status' });
  }
};

// Get onsite visit tracking history
export const getOnsiteVisitTracking = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const permission = await checkTicketAccess(user, Number(ticketId));
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.error });
    }

    // Get onsite visit logs
    const onsiteVisitLogs = await prisma.onsiteVisitLog.findMany({
      where: { ticketId: Number(ticketId) },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Get ticket details for context
    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(ticketId) },
      select: {
        visitPlannedDate: true,
        visitStartedAt: true,
        visitReachedAt: true,
        visitInProgressAt: true,
        visitResolvedAt: true,
        visitCompletedDate: true,
        onsiteStartLocation: true,
        onsiteEndLocation: true,
        onsiteLocationHistory: true,
      },
    });

    res.json({
      ticket: ticket,
      onsiteVisitLogs: onsiteVisitLogs,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch onsite visit tracking' });
  }
};

// Enhanced update status function with lifecycle validation
export const updateStatusWithLifecycle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, comments, latitude, longitude, address } = req.body;
    const user = req.user as any;

    const permission = await checkTicketAccess(user, Number(id));
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.error });
    }

    if (!Object.values(TicketStatus).includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Fetch current ticket to validate transition
    const currentTicket = await prisma.ticket.findUnique({
      where: { id: Number(id) },
    });
    if (!currentTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Validate status transition
    if (!isValidTransition(currentTicket.status as TicketStatus, status)) {
      return res.status(400).json({
        error: `Invalid status transition from ${currentTicket.status} to ${status}`
      });
    }

    const { timeInStatus, totalTimeOpen } = updateTimeTracking(currentTicket);

    // Prepare update data based on status
    const updateData: any = {
      status,
      lastStatusChange: new Date(),
      timeInStatus,
      totalTimeOpen
    };

    // Add timestamp fields based on status
    switch (status) {
      case TicketStatus.ONSITE_VISIT_STARTED:
        updateData.visitStartedAt = new Date();
        if (latitude && longitude) {
          updateData.onsiteStartLocation = JSON.stringify({ latitude, longitude, address });
        }
        break;
      case TicketStatus.ONSITE_VISIT_REACHED:
        updateData.visitReachedAt = new Date();
        break;
      case TicketStatus.ONSITE_VISIT_IN_PROGRESS:
        updateData.visitInProgressAt = new Date();
        break;
      case TicketStatus.ONSITE_VISIT_RESOLVED:
        updateData.visitResolvedAt = new Date();
        break;
      case TicketStatus.ONSITE_VISIT_COMPLETED:
        updateData.visitCompletedDate = new Date();
        if (latitude && longitude) {
          updateData.onsiteEndLocation = JSON.stringify({ latitude, longitude, address });
        }
        break;
      case TicketStatus.PO_REACHED:
        updateData.poReachedAt = new Date();
        break;
      case TicketStatus.CLOSED_PENDING:
        // Only technicians can set to CLOSED_PENDING
        if (user.role !== UserRoleEnum.SERVICE_PERSON) {
          return res.status(403).json({ error: 'Only technicians can mark tickets as closed pending' });
        }
        break;
      case TicketStatus.CLOSED:
        // Only admins can set to CLOSED
        if (user.role !== UserRoleEnum.ADMIN) {
          return res.status(403).json({ error: 'Only admins can close tickets' });
        }
        break;
    }

    // Update the ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id: Number(id) },
      data: updateData,
    });

    // Create onsite visit log if location provided and it's an onsite status
    if (latitude && longitude && status.startsWith('ONSITE_VISIT_')) {
      const eventMap: Record<string, string> = {
        'ONSITE_VISIT_STARTED': 'STARTED',
        'ONSITE_VISIT_REACHED': 'REACHED',
        'ONSITE_VISIT_IN_PROGRESS': 'WORK_STARTED',
        'ONSITE_VISIT_RESOLVED': 'RESOLVED',
        'ONSITE_VISIT_PENDING': 'PENDING',
        'ONSITE_VISIT_COMPLETED': 'ENDED',
      };

      const event = eventMap[status];
      if (event) {
        await prisma.onsiteVisitLog.create({
          data: {
            ticketId: Number(id),
            userId: user.id,
            event: event as any,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            address: address || null,
          },
        });
      }
    }

    // Insert status history record
    await prisma.ticketStatusHistory.create({
      data: {
        ticket: { connect: { id: Number(id) } },
        status: status,
        changedBy: { connect: { id: user.id } },
        changedAt: new Date(),
        notes: comments,
        timeInStatus,
        totalTimeOpen,
      },
    });

    // Create automatic activity log for ticket status update
    try {
      await ActivityController.logActivity({
        userId: user.id,
        action: `TICKET_STATUS_CHANGED`,
        entityType: 'TICKET',
        entityId: Number(id).toString(),
        details: {
          oldStatus: currentTicket.status,
          newStatus: status
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (activityError) {
    }

    return res.json(updatedTicket);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update status' });
  }
};

// Get photos for a ticket
export const getTicketPhotos = async (req: TicketRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as AuthUser;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Ticket ID is required'
      });
    }

    // Check if ticket exists and user has access
    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(id) },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    const hasAccess = await checkTicketAccess(user, Number(id));
    if (!hasAccess.allowed) {
      return res.status(403).json({
        success: false,
        error: hasAccess.error
      });
    }

    // Get photos from local storage service
    const photos = await LocalPhotoStorageService.getTicketPhotos(Number(id));

    return res.json({
      success: true,
      photos: photos
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch photos'
    });
  }
};

// Respond to ticket assignment (accept or reject)
export const respondToAssignment = async (req: TicketRequest, res: Response) => {
  try {
    const { id: ticketId } = req.params;
    const { action, notes } = req.body; // action: 'ACCEPT' | 'REJECT'
    const user = req.user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!action || !['ACCEPT', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Action must be ACCEPT or REJECT' });
    }

    // Get the ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(ticketId) },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, role: true }
        },
        owner: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Verify the user is the assigned user
    if (ticket.assignedToId !== user.id) {
      return res.status(403).json({ error: 'You are not assigned to this ticket' });
    }

    // Check if already responded
    if (ticket.assignmentStatus !== 'PENDING') {
      return res.status(400).json({ error: `Assignment already ${ticket.assignmentStatus?.toLowerCase()}` });
    }

    // Update the ticket
    const newAssignmentStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';

    const updatedTicket = await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        assignmentStatus: newAssignmentStatus,
        assignmentRespondedAt: new Date(),
        assignmentNotes: notes || null,
        // If rejected, clear the assignment
        ...(action === 'REJECT' && {
          assignedToId: null,
          status: 'OPEN' // Reset to OPEN so admin can reassign
        }),
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, role: true }
        },
        customer: {
          select: { id: true, companyName: true }
        },
        zone: {
          select: { id: true, name: true }
        }
      }
    });

    // Create status history entry
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: updatedTicket.id,
        status: updatedTicket.status,
        changedById: user.id,
        notes: action === 'ACCEPT'
          ? `${user.name || user.email} accepted the assignment`
          : `${user.name || user.email} rejected the assignment${notes ? ': ' + notes : ''}`,
      }
    });

    // Create notification for the ticket owner (admin who assigned)
    try {
      await prisma.notification.create({
        data: {
          userId: ticket.ownerId,
          title: action === 'ACCEPT' ? 'Assignment Accepted' : 'Assignment Rejected',
          message: action === 'ACCEPT'
            ? `${user.name || user.email} accepted the assignment for ticket #${ticket.id}`
            : `${user.name || user.email} rejected the assignment for ticket #${ticket.id}${notes ? '. Reason: ' + notes : ''}`,
          type: 'TICKET_UPDATED',
          data: {
            ticketId: ticket.id,
            action: action,
            respondedBy: user.id,
            respondedByName: user.name || user.email,
            notes: notes
          }
        }
      });
    } catch (notificationError) {
      // Don't fail if notification fails

    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: action === 'ACCEPT' ? 'ASSIGNMENT_ACCEPTED' : 'ASSIGNMENT_REJECTED',
        entityType: 'TICKET',
        entityId: Number(ticketId),
        userId: user.id,
        details: action === 'ACCEPT'
          ? `Accepted assignment for ticket #${ticketId}`
          : `Rejected assignment for ticket #${ticketId}${notes ? ': ' + notes : ''}`,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: action === 'ACCEPT' ? 'Assignment accepted' : 'Assignment rejected',
      ticket: updatedTicket
    });

  } catch (error) {

    res.status(500).json({ error: 'Failed to respond to assignment' });
  }
};
