import React, { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MobileTable, MobileCard } from '@/components/ui/mobile-responsive';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Eye, 
  Pencil, 
  Users,
  Plus,
  CheckCircle2,
  XCircle,
  Package,
  Globe,
  ArrowUpRight
} from 'lucide-react';
import { Customer } from '@/types/customer';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface CustomerTableProps {
  customers: Customer[];
  readOnly?: boolean;
}

// Memoized customer row component for better performance
const CustomerRow = memo(({ customer, readOnly, basePath, index }: { customer: Customer; readOnly?: boolean; basePath: string; index: number }) => {
  const primaryContact = useMemo(() => {
    return customer.contacts && customer.contacts.length > 0 ? customer.contacts[0] : null;
  }, [customer.contacts]);

  const companyInitials = useMemo(() => {
    const words = customer.companyName.split(' ');
    if (words.length >= 2) {
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
    return customer.companyName.substring(0, 2).toUpperCase();
  }, [customer.companyName]);

  // Gradient colors based on index for variety
  const gradientColors = [
    'from-[#6F8A9D] to-[#546A7A]',
    'from-[#82A094] to-[#4F6A64]',
    'from-[#6F8A9D] to-[#546A7A]',
    'from-[#CE9F6B] to-[#976E44]',
    'from-[#E17F70] to-[#9E3B47]',
    'from-[#6F8A9D] to-[#546A7A]',
  ];
  const gradient = gradientColors[index % gradientColors.length];

  return (
    <tr className="group hover:bg-gradient-to-r hover:from-[#96AEC2]/10/50 hover:to-[#6F8A9D]/10/30 transition-all duration-200 border-b border-[#AEBFC3]/30/80 last:border-b-0">
      <td className="py-4 px-5">
        <div className="flex items-center gap-4">
          <div className={cn(
            "h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-semibold text-sm shadow-md group-hover:shadow-lg transition-shadow duration-200",
            gradient
          )}>
            {companyInitials}
          </div>
          <div className="min-w-0 flex-1">
            <Link 
              href={`${basePath}/customers/${customer.id}`}
              className="font-semibold text-[#546A7A] hover:text-[#546A7A] transition-colors flex items-center gap-1 group/link"
            >
              <span className="truncate max-w-[200px]">{customer.companyName}</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover/link:opacity-100 transition-opacity text-[#6F8A9D]" />
            </Link>
            {customer.serviceZone?.name && (
              <div className="text-xs text-[#AEBFC3]0 flex items-center mt-1 gap-1">
                <Globe className="h-3 w-3 text-[#6F8A9D]" />
                <span className="truncate max-w-[180px]">{customer.serviceZone.name}</span>
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="py-4 px-5">
        <div className="flex items-start text-sm text-[#5D6E73] min-w-0">
          <MapPin className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5 text-[#979796]" />
          <span className="line-clamp-2 leading-relaxed">{customer.address || 'No address'}</span>
        </div>
      </td>
      <td className="py-4 px-5">
        <div className="min-w-0">
          {primaryContact ? (
            <div className="space-y-1.5">
              {primaryContact.name && (
                <div className="font-medium text-[#546A7A] text-sm flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-full bg-[#AEBFC3]/20 flex items-center justify-center">
                    <Users className="h-3 w-3 text-[#AEBFC3]0" />
                  </div>
                  <span className="truncate max-w-[150px]">{primaryContact.name}</span>
                </div>
              )}
              {primaryContact.email && (
                <div className="flex items-center text-xs text-[#AEBFC3]0">
                  <Mail className="h-3 w-3 mr-1.5 text-[#979796]" />
                  <a 
                    href={`mailto:${primaryContact.email}`} 
                    className="hover:text-[#546A7A] hover:underline truncate max-w-[180px] transition-colors"
                  >
                    {primaryContact.email}
                  </a>
                </div>
              )}
              {primaryContact.phone && (
                <div className="flex items-center text-xs text-[#AEBFC3]0">
                  <Phone className="h-3 w-3 mr-1.5 text-[#979796]" />
                  <a 
                    href={`tel:${primaryContact.phone}`} 
                    className="hover:text-[#546A7A] hover:underline transition-colors"
                  >
                    {primaryContact.phone}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-[#979796] flex items-center gap-1.5 bg-[#AEBFC3]/10 rounded-lg px-2.5 py-1.5 w-fit">
              <Users className="h-3.5 w-3.5" />
              <span>{customer._count?.contacts ? `${customer._count.contacts} contacts` : 'No contacts'}</span>
            </div>
          )}
        </div>
      </td>
      <td className="py-4 px-5">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-[#6F8A9D]/10 to-[#6F8A9D]/10 text-[#546A7A] px-3 py-1.5 rounded-lg border border-[#6F8A9D]/30">
            <Package className="h-3.5 w-3.5" />
            <span className="font-semibold text-sm">{customer._count?.assets || 0}</span>
          </div>
        </div>
      </td>
      <td className="py-4 px-5">
        <div className="flex items-center justify-center">
          {customer.isActive ? (
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-[#A2B9AF]/10 to-[#A2B9AF]/10 text-[#4F6A64] px-3 py-1.5 rounded-lg border border-[#A2B9AF]/30">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="font-medium text-sm">Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-[#AEBFC3]/10 to-[#AEBFC3]/10 text-[#5D6E73] px-3 py-1.5 rounded-lg border border-[#92A2A5]">
              <XCircle className="h-3.5 w-3.5" />
              <span className="font-medium text-sm">Inactive</span>
            </div>
          )}
        </div>
      </td>
      <td className="py-4 px-5">
        <div className="flex items-center justify-end gap-1">
          <Link 
            href={`${basePath}/customers/${customer.id}`}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-[#96AEC2]/10 hover:bg-[#96AEC2]/20 text-[#546A7A] transition-all duration-200 hover:scale-105"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Link>
          {!readOnly && (
            <Link 
              href={`/admin/customers/${customer.id}/edit`}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-[#CE9F6B]/10 hover:bg-[#CE9F6B]/20 text-[#976E44] transition-all duration-200 hover:scale-105"
              title="Edit Customer"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
});

CustomerRow.displayName = 'CustomerRow';

// Mobile customer card component
const CustomerMobileCard = memo(({ customer, readOnly, basePath, index }: { customer: Customer; readOnly?: boolean; basePath: string; index: number }) => {
  const primaryContact = useMemo(() => {
    return customer.contacts && customer.contacts.length > 0 ? customer.contacts[0] : null;
  }, [customer.contacts]);

  const companyInitials = useMemo(() => {
    const words = customer.companyName.split(' ');
    if (words.length >= 2) {
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
    return customer.companyName.substring(0, 2).toUpperCase();
  }, [customer.companyName]);

  const gradientColors = [
    'from-[#6F8A9D] to-[#546A7A]',
    'from-[#82A094] to-[#4F6A64]',
    'from-[#6F8A9D] to-[#546A7A]',
    'from-[#CE9F6B] to-[#976E44]',
    'from-[#E17F70] to-[#9E3B47]',
    'from-[#6F8A9D] to-[#546A7A]',
  ];
  const gradient = gradientColors[index % gradientColors.length];

  return (
    <div className="bg-white rounded-2xl border border-[#AEBFC3]/30 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
      {/* Gradient accent bar */}
      <div className={cn("h-1.5 bg-gradient-to-r", gradient)} />
      
      <div className="p-5 space-y-4">
        {/* Header with company name and avatar */}
        <div className="flex items-start gap-4">
          <div className={cn(
            "h-14 w-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg shadow-lg",
            gradient
          )}>
            {companyInitials}
          </div>
          <div className="min-w-0 flex-1">
            <Link 
              href={`${basePath}/customers/${customer.id}`}
              className="font-bold text-lg text-[#546A7A] hover:text-[#546A7A] transition-colors block leading-tight"
            >
              {customer.companyName}
            </Link>
            {customer.serviceZone?.name && (
              <div className="text-sm text-[#AEBFC3]0 flex items-center mt-1.5 gap-1">
                <Globe className="h-4 w-4 text-[#6F8A9D]" />
                <span>{customer.serviceZone.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link 
              href={`${basePath}/customers/${customer.id}`}
              className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-[#96AEC2]/10 hover:bg-[#96AEC2]/20 text-[#546A7A] transition-colors"
            >
              <Eye className="h-5 w-5" />
            </Link>
            {!readOnly && (
              <Link 
                href={`/admin/customers/${customer.id}/edit`}
                className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-[#CE9F6B]/10 hover:bg-[#CE9F6B]/20 text-[#976E44] transition-colors"
              >
                <Pencil className="h-5 w-5" />
              </Link>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="flex items-start text-sm text-[#5D6E73] bg-[#AEBFC3]/10/80 rounded-xl p-3">
          <MapPin className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5 text-[#979796]" />
          <span className="leading-relaxed">{customer.address || 'No address provided'}</span>
        </div>

        {/* Contact Information */}
        {primaryContact && (
          <div className="bg-gradient-to-r from-[#96AEC2]/10/50 to-[#6F8A9D]/10/50 rounded-xl p-3 space-y-2">
            {primaryContact.name && (
              <div className="font-medium text-[#546A7A] flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-white shadow-sm flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-[#6F8A9D]" />
                </div>
                {primaryContact.name}
              </div>
            )}
            <div className="flex flex-wrap gap-3 text-sm text-[#5D6E73]">
              {primaryContact.email && (
                <a 
                  href={`mailto:${primaryContact.email}`} 
                  className="flex items-center gap-1 hover:text-[#546A7A] transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[180px]">{primaryContact.email}</span>
                </a>
              )}
              {primaryContact.phone && (
                <a 
                  href={`tel:${primaryContact.phone}`} 
                  className="flex items-center gap-1 hover:text-[#546A7A] transition-colors"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {primaryContact.phone}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Stats and Status */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="bg-gradient-to-br from-[#6F8A9D]/10 to-[#6F8A9D]/10 rounded-xl p-3 text-center border border-[#6F8A9D]/30">
            <div className="flex items-center justify-center gap-1.5 text-[#546A7A]">
              <Package className="h-4 w-4" />
              <span className="text-xl font-bold">{customer._count?.assets || 0}</span>
            </div>
            <div className="text-xs text-[#546A7A] mt-1 font-medium">Assets</div>
          </div>
          <div className={cn(
            "rounded-xl p-3 text-center border",
            customer.isActive 
              ? "bg-gradient-to-br from-[#A2B9AF]/10 to-[#A2B9AF]/10 border-[#A2B9AF]/30"
              : "bg-gradient-to-br from-[#AEBFC3]/10 to-[#AEBFC3]/10 border-[#92A2A5]"
          )}>
            <div className={cn(
              "flex items-center justify-center gap-1.5",
              customer.isActive ? "text-[#4F6A64]" : "text-[#5D6E73]"
            )}>
              {customer.isActive ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <span className="text-sm font-bold">{customer.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div className={cn(
              "text-xs mt-1 font-medium",
              customer.isActive ? "text-[#4F6A64]" : "text-[#AEBFC3]0"
            )}>Status</div>
          </div>
        </div>
      </div>
    </div>
  );
});

CustomerMobileCard.displayName = 'CustomerMobileCard';

const CustomerTable = memo(function CustomerTable({ customers, readOnly = false }: CustomerTableProps) {
  // Memoize the customer count to prevent unnecessary recalculations
  const customerCount = useMemo(() => customers.length, [customers.length]);
  
  // Determine base path based on readOnly mode
  const basePath = readOnly ? '/zone' : '/admin';

  if (!customerCount) {
    return (
      <>
        {/* Desktop Empty State */}
        <Card className="shadow-xl border-0 hidden md:block overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D]" />
          <CardHeader className="bg-gradient-to-br from-[#AEBFC3]/10 via-[#96AEC2]/10/30 to-[#6F8A9D]/10/50 pb-8">
            <CardTitle className="text-[#546A7A] flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center shadow-lg">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl">Customers</span>
              <Badge variant="secondary" className="ml-2 bg-[#92A2A5]/30 text-[#5D6E73]">0</Badge>
            </CardTitle>
            <CardDescription className="text-[#AEBFC3]0 mt-2">
              Manage customer relationships and business data
            </CardDescription>
          </CardHeader>
          <CardContent className="py-16">
            <div className="text-center">
              <div className="mx-auto h-28 w-28 rounded-3xl bg-gradient-to-br from-[#96AEC2]/20 via-indigo-100 to-[#6F8A9D]/20 flex items-center justify-center mb-6 shadow-inner">
                <Building2 className="h-14 w-14 text-[#6F8A9D]" />
              </div>
              <h3 className="text-xl font-semibold text-[#546A7A] mb-3">No customers found</h3>
              <p className="text-[#AEBFC3]0 mb-8 max-w-sm mx-auto">
                Get started by adding your first customer to manage their assets and relationships.
              </p>
              {!readOnly && (
                <Link href="/admin/customers/new">
                  <Button className="bg-gradient-to-r from-[#546A7A] via-[#546A7A] to-[#546A7A] hover:from-[#546A7A] hover:via-indigo-700 hover:to-[#546A7A] shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 px-8 py-6 text-base">
                    <Plus className="mr-2 h-5 w-5" />
                    Add Your First Customer
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mobile Empty State */}
        <div className="md:hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center shadow-lg">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-[#546A7A]">Customers</h2>
            <Badge variant="secondary" className="bg-[#92A2A5]/30 text-[#5D6E73]">0</Badge>
          </div>
          <div className="bg-white rounded-2xl border border-[#AEBFC3]/30 shadow-lg overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D]" />
            <div className="text-center py-12 px-6">
              <div className="mx-auto h-24 w-24 rounded-2xl bg-gradient-to-br from-[#96AEC2]/20 via-indigo-100 to-[#6F8A9D]/20 flex items-center justify-center mb-5 shadow-inner">
                <Building2 className="h-12 w-12 text-[#6F8A9D]" />
              </div>
              <h3 className="text-lg font-semibold text-[#546A7A] mb-2">No customers found</h3>
              <p className="text-[#AEBFC3]0 mb-6 text-sm">
                Get started by adding your first customer.
              </p>
              {!readOnly && (
                <Link href="/admin/customers/new">
                  <Button className="bg-gradient-to-r from-[#546A7A] via-[#546A7A] to-[#546A7A] hover:from-[#546A7A] hover:via-indigo-700 hover:to-[#546A7A] shadow-lg w-full py-6">
                    <Plus className="mr-2 h-5 w-5" />
                    Add Customer
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <Card className="shadow-xl border-0 hidden md:block overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D]" />
        <CardHeader className="bg-gradient-to-br from-[#AEBFC3]/10 via-[#96AEC2]/10/30 to-[#6F8A9D]/10/50 border-b border-[#AEBFC3]/30">
          <CardTitle className="text-[#546A7A] flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center shadow-lg">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl">Customers</span>
            <Badge className="ml-2 bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white border-0 shadow-md">
              {customerCount}
            </Badge>
          </CardTitle>
          <CardDescription className="text-[#AEBFC3]0 mt-1">
            Manage customer relationships and business data
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <MobileTable>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-[#AEBFC3]/10 to-[#AEBFC3]/10 border-b border-[#92A2A5]">
                    <th className="text-left py-4 px-5 font-semibold text-[#5D6E73] text-sm uppercase tracking-wider">Company</th>
                    <th className="text-left py-4 px-5 font-semibold text-[#5D6E73] text-sm uppercase tracking-wider">Location</th>
                    <th className="text-left py-4 px-5 font-semibold text-[#5D6E73] text-sm uppercase tracking-wider">Contact</th>
                    <th className="text-center py-4 px-5 font-semibold text-[#5D6E73] text-sm uppercase tracking-wider">Assets</th>
                    <th className="text-center py-4 px-5 font-semibold text-[#5D6E73] text-sm uppercase tracking-wider">Status</th>
                    <th className="text-right py-4 px-5 font-semibold text-[#5D6E73] text-sm uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer, index) => (
                    <CustomerRow key={customer.id} customer={customer} readOnly={readOnly} basePath={basePath} index={index} />
                  ))}
                </tbody>
              </table>
            </div>
          </MobileTable>
        </CardContent>
      </Card>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center shadow-lg">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-[#546A7A]">Customers</h2>
          <Badge className="bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white border-0 shadow-md">
            {customerCount}
          </Badge>
        </div>
        <div className="space-y-4">
          {customers.map((customer, index) => (
            <CustomerMobileCard key={customer.id} customer={customer} readOnly={readOnly} basePath={basePath} index={index} />
          ))}
        </div>
      </div>
    </>
  );
});

CustomerTable.displayName = 'CustomerTable';

export default CustomerTable;
