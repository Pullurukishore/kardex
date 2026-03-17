import { UserRole, FinanceRole } from '@/types/user.types';

export interface AuthResponseUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  financeRole?: FinanceRole;
  arRole?: FinanceRole | null;
  vendorRole?: FinanceRole | null;
  // Add other user properties as needed
}
