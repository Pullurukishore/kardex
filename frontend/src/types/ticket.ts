export enum TicketStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  WAITING_CUSTOMER = 'WAITING_CUSTOMER',
  ONSITE_VISIT = 'ONSITE_VISIT',
  ONSITE_VISIT_PLANNED = 'ONSITE_VISIT_PLANNED',
  ONSITE_VISIT_STARTED = 'ONSITE_VISIT_STARTED',
  ONSITE_VISIT_REACHED = 'ONSITE_VISIT_REACHED',
  ONSITE_VISIT_IN_PROGRESS = 'ONSITE_VISIT_IN_PROGRESS',
  ONSITE_VISIT_RESOLVED = 'ONSITE_VISIT_RESOLVED',
  ONSITE_VISIT_PENDING = 'ONSITE_VISIT_PENDING',
  ONSITE_VISIT_COMPLETED = 'ONSITE_VISIT_COMPLETED',
  PO_NEEDED = 'PO_NEEDED',
  PO_REACHED = 'PO_REACHED',
  PO_RECEIVED = 'PO_RECEIVED',
  SPARE_PARTS_NEEDED = 'SPARE_PARTS_NEEDED',
  SPARE_PARTS_BOOKED = 'SPARE_PARTS_BOOKED',
  SPARE_PARTS_DELIVERED = 'SPARE_PARTS_DELIVERED',
  CLOSED_PENDING = 'CLOSED_PENDING',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
  REOPENED = 'REOPENED',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  ESCALATED = 'ESCALATED',
  RESOLVED = 'RESOLVED'
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum CallType {
  UNDER_MAINTENANCE_CONTRACT = 'UNDER_MAINTENANCE_CONTRACT',
  NOT_UNDER_CONTRACT = 'NOT_UNDER_CONTRACT'
}

export enum SupportMode {
  ON_SITE = 'ON_SITE',
  PHONE_CALL = 'PHONE_CALL'
}

export interface User {
  id: number;
  email: string;
  name?: string;
  phone?: string;
  role: 'ADMIN' | 'ZONE_USER' | 'SERVICE_PERSON' | 'ZONE_MANAGER' | 'EXPERT_HELPDESK' | 'EXTERNAL_USER';
  isActive?: boolean;
}

export interface Customer {
  id: number;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface Asset {
  id: number;
  machineId?: string;
  model: string;
  serialNumber?: string;
  purchaseDate?: string;
  warrantyEndDate?: string;
  amcEndDate?: string;
  softwareVersion?: string;
  installationDate?: string;
  relatedMachineIds?: number[];
  status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
}

export interface Comment {
  id: number;
  content: string;
  isInternal: boolean;
  createdAt: string;
  author: User;
}

export interface Ticket {
  id: number;
  ticketNumber?: number; // User-facing ticket number starting from 1001
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  callType?: CallType;
  createdAt: string;
  updatedAt: string;
  lastStatusChange?: string;
  resolvedAt?: string;
  closedAt?: string;
  onsiteVisitDate?: string;
  errorDetails?: string;
  proofImages?: string[];
  relatedMachineIds?: number[];
  supportMode?: SupportMode;
  sparePartsDetails?: any;
  poNumber?: string;
  poApprovedAt?: string;
  feedback?: string;
  rating?: number;
  // Assignment fields
  assignedToId?: number;
  assignmentStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  assignmentRespondedAt?: string;
  assignmentNotes?: string;
  // Relations
  customer: Customer;
  createdBy: User;
  owner: User;
  assignedTo?: User;
  subOwner?: User;
  poApprovedBy?: User;
  asset?: Asset;
  contact?: any;
  zone?: any;
  comments?: Comment[];
  statusHistory?: TicketStatusHistory[];
  poRequests?: PORequest[];
}

export interface TicketFormValues {
  title: string;
  description: string;
  priority: Priority;
  customerId: string;
  contactId: string;
  assetId?: string;
  zoneId: string;
  errorDetails?: string;
}

export interface TicketFormData {
  title: string;
  description: string;
  priority: Priority;
  customerId: number;
  contactId: number;
  serviceZoneId: number;
  assetId: number;
  errorDetails?: string;
  proofImages: string[];
  relatedAssetIds: number[];
}

export interface TicketFilterOptions {
  status?: TicketStatus;
  priority?: Priority;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ApiResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface StatusUpdateData {
  status: TicketStatus;
  comments?: string;
}

export interface AssignTicketData {
  assignedToId: number;
}

export interface AddCommentData {
  content: string;
  isInternal?: boolean;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  timestamp?: string;
  accuracy?: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface TicketStatusHistory {
  id: number;
  ticketId: number;
  status: TicketStatus;
  changedById: number;
  changedAt: string;
  notes?: string;
  changedBy: User;
  location?: LocationData;
}

export interface PORequest {
  id: number;
  ticketId: number;
  amount?: number;
  description: string;
  notes?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedById: number;
  approvedById?: number;
  requestedAt: string;
  approvedAt?: string;
  requestedBy: User;
  approvedBy?: User;
}

export interface AssignToZoneUserData {
  zoneUserId: number;
}

export interface PlanOnsiteVisitData {
  servicePersonId: number;
  visitDate: string;
  notes?: string;
}

export interface CompleteOnsiteVisitData {
  resolutionSummary: string;
  isResolved: boolean;
  sparePartsNeeded?: boolean;
  sparePartsDetails?: any;
}

export interface RequestPOData {
  description: string;
  amount?: number;
  notes?: string;
}

export interface ApprovePOData {
  poNumber: string;
  notes?: string;
}

export interface UpdateSparePartsData {
  status: 'BOOKED' | 'DELIVERED';
  details?: any;
}

export interface CloseTicketData {
  feedback?: string;
  rating?: number;
}

export interface AddNoteData {
  content: string;
}

export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: 'TICKET_CREATED' | 'TICKET_UPDATED' | 'TICKET_COMMENT' | 'TICKET_ASSIGNED' | 'PO_CREATED' | 'PO_UPDATED' | 'PO_APPROVAL' | 'SYSTEM_ALERT' | 'MAINTENANCE' | 'OTHER';
  status: 'UNREAD' | 'READ' | 'ARCHIVED';
  data?: any;
  createdAt: string;
  readAt?: string;
}

export interface TicketStats {
  total: number;
  open: number;
  assigned: number;
  closed: number;
  critical: number;
}
