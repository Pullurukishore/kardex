// FSM Roles (Field Service Management)
export enum UserRole {
  ADMIN = 'ADMIN',
  ZONE_MANAGER = 'ZONE_MANAGER',
  ZONE_USER = 'ZONE_USER',
  SERVICE_PERSON = 'SERVICE_PERSON',
  EXTERNAL_USER = 'EXTERNAL_USER',
  EXPERT_HELPDESK = 'EXPERT_HELPDESK',
}

// Finance Module Roles
export enum FinanceRole {
  FINANCE_ADMIN = 'FINANCE_ADMIN',
  FINANCE_USER = 'FINANCE_USER',
  FINANCE_VIEWER = 'FINANCE_VIEWER',
  FINANCE_APPROVER = 'FINANCE_APPROVER',
}

// Module types
export type ModuleType = 'fsm' | 'finance';

export interface ServiceZone {
  serviceZoneId: number;
  serviceZone: {
    id: number;
    name: string;
  };
}

export type User = {
  id: string | number;  // Handle both string and number IDs
  email: string;
  role: UserRole;  // Primary FSM role
  financeRole?: FinanceRole;  // Finance module role (optional)
  allowedModules?: ModuleType[];  // Which modules user can access
  name: string | null;  // Allow null for name
  isActive?: boolean;
  tokenVersion?: string | number;  // Handle both string and number token versions
  customerId?: string | number | null;  // Handle both string and number
  zoneId?: string | number | null;  // Handle both string and number
  serviceZones?: ServiceZone[];
  zoneIds?: number[];  // Array of zone IDs for zone filtering
  // Add other user properties as needed
  [key: string]: any;  // Allow additional properties
};

// Type guard to check if a value is a User
export function isUser(value: any): value is User {
  return (
    value &&
    (typeof value.id === 'string' || typeof value.id === 'number') &&
    typeof value.email === 'string' &&
    Object.values(UserRole).includes(value.role) &&
    typeof value.name === 'string'
  );
}

// Helper to check if user has access to a module
export function hasModuleAccess(user: User | null, module: ModuleType): boolean {
  if (!user) return false;

  // Check allowedModules array if present (explicit override)
  if (user.allowedModules && Array.isArray(user.allowedModules)) {
    return user.allowedModules.includes(module);
  }

  if (module === 'fsm') {
    return !!user.role;
  }

  if (module === 'finance') {
    return !!user.financeRole;
  }

  return false;
}
