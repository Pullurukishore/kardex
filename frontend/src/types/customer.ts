export interface Contact {
  id: number;
  name: string;
  email?: string;
  phone: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: number;
  companyName: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  taxId?: string;
  notes?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  isActive: boolean;
  serviceZoneId: number;
  serviceZone?: {
    id: number;
    name: string;
  };
  _count: {
    assets: number;
    contacts: number;
    tickets: number;
  };
  contacts: Contact[];
  assets: any[];
  tickets: any[];
  createdAt: string;
  updatedAt: string;
  createdById: number;
  updatedById: number;
}

export interface CustomerFormData {
  // Customer fields from database
  companyName: string;
  industry?: string;
  address?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'; // Used internally in forms
  isActive?: boolean; // What the backend API actually expects
  serviceZoneId: number;
  // Contact information (stored in contacts table)
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
}

export interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
  totalAssets: number;
  totalTickets: number;
}
