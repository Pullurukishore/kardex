// src/app/(dashboard)/expert/customers/[id]/page.tsx
"use client";

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Building2, 
  Pencil, 
  MapPin, 
  Phone, 
  Mail, 
  Users, 
  Ticket, 
  HardDrive, 
  Calendar,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  Globe,
  Clock,
  Activity,
  TrendingUp,
  MoreHorizontal,
  ExternalLink
} from 'lucide-react';
import { fetchCustomer, deleteCustomer } from '@/services/customer.service';
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';
import { format } from 'date-fns';
import { Customer, Contact } from '@/types/customer';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

const getStatusBadgeStyles = (isActive: boolean) => {
  return isActive 
    ? 'bg-[#A2B9AF]/20 text-[#4F6A64] hover:bg-[#82A094]/30' 
    : 'bg-[#AEBFC3]/20 text-[#546A7A] hover:bg-[#92A2A5]/30';
};

export default function ExpertCustomerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      const data = await fetchCustomer(Number(id));
      setCustomer(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load customer details',
        variant: 'destructive',
      });
      router.push('/expert/customers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!customer) return;
    
    try {
      setDeleting(true);
      await deleteCustomer(customer.id);
      
      toast({
        title: 'Success',
        description: `${customer.companyName} has been deleted successfully`,
      });
      
      router.push('/expert/customers');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete customer. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadCustomer();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading customer details...</span>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-lg font-medium">Customer not found</h3>
        <p className="mt-1 text-muted-foreground">The customer you're looking for doesn't exist or was deleted.</p>
        <Button className="mt-4" onClick={() => router.push('/expert/customers')}>
          Back to Customers
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/expert/customers')} 
            className="p-2"
            title="Back to Customers"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#546A7A]">{customer.companyName}</h1>
            <p className="text-sm text-muted-foreground">
              Customer Details • ID: {customer.id}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            onClick={() => router.push(`/expert/customers/${id}/edit`)}
            className="bg-white hover:bg-[#AEBFC3]/10"
          >
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={deleting}
            className="bg-[#9E3B47] hover:bg-[#75242D]"
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </>
            )}
          </Button>
        </div>
      </div>

      <div className={`rounded-lg border p-4 ${customer.isActive ? 'bg-[#A2B9AF]/10 border-[#A2B9AF]' : 'bg-[#AEBFC3]/10 border-[#92A2A5]'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${customer.isActive ? 'bg-[#A2B9AF]/20' : 'bg-[#AEBFC3]/20'}`}>
              <Activity className={`h-5 w-5 ${customer.isActive ? 'text-[#4F6A64]' : 'text-[#5D6E73]'}`} />
            </div>
            <div>
              <h3 className="font-medium text-[#546A7A]">
                Customer Status: {customer.isActive ? 'Active' : 'Inactive'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {customer.isActive ? 'This customer is currently active and receiving services' : 'This customer is inactive'}
              </p>
            </div>
          </div>
          <Badge 
            className={`${customer.isActive ? 'bg-[#A2B9AF]/20 text-[#4F6A64]' : 'bg-[#AEBFC3]/20 text-[#546A7A]'} font-medium`}
            variant="outline"
          >
            {customer.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Customer Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D] shadow-sm">
                    <Building2 className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-[#546A7A]">{customer.companyName}</CardTitle>
                    <CardDescription className="mt-1 flex items-center text-base">
                      <MapPin className="h-4 w-4 mr-1" />
                      {customer.serviceZone?.name || 'No service zone assigned'}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-[#AEBFC3]/10 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-[#5D6E73] mb-3 flex items-center">
                      <MapPin className="h-4 w-4 mr-2 text-[#546A7A]" />
                      Address Information
                    </h3>
                    <div className="space-y-2 text-sm text-[#5D6E73]">
                      <p className="font-medium text-[#546A7A]">{customer.address || 'N/A'}</p>
                      <p>{customer.city}, {customer.state} {customer.postalCode}</p>
                      <p>{customer.country}</p>
                    </div>
                  </div>
                  
                  <div className="bg-[#96AEC2]/10 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-[#5D6E73] mb-3 flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-[#546A7A]" />
                      Contact Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-[#979796]" />
                        <a 
                          href={`tel:${customer.phone}`} 
                          className="text-sm text-[#546A7A] hover:text-[#546A7A] hover:underline font-medium"
                        >
                          {customer.phone || 'N/A'}
                        </a>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-[#979796]" />
                        <a 
                          href={`mailto:${customer.email}`} 
                          className="text-sm text-[#546A7A] hover:text-[#546A7A] hover:underline font-medium"
                        >
                          {customer.email}
                        </a>
                      </div>
                      {customer.website && (
                        <div className="flex items-center space-x-2">
                          <Globe className="h-4 w-4 text-[#979796]" />
                          <a 
                            href={customer.website.startsWith('http') ? customer.website : `https://${customer.website}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-[#546A7A] hover:text-[#546A7A] hover:underline font-medium flex items-center"
                          >
                            {customer.website}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-[#A2B9AF]/10 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-[#5D6E73] mb-3 flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-[#4F6A64]" />
                      Business Information
                    </h3>
                    <div className="space-y-3 text-sm">
                      {customer.phone && (
                        <div className="flex justify-between">
                          <span className="text-[#5D6E73]">Phone:</span>
                          <span className="font-medium text-[#546A7A]">{customer.phone}</span>
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex justify-between">
                          <span className="text-[#5D6E73]">Email:</span>
                          <span className="font-medium text-[#546A7A]">{customer.email}</span>
                        </div>
                      )}
                      {customer.website && (
                        <div className="flex justify-between">
                          <span className="text-[#5D6E73]">Website:</span>
                          <a href={customer.website} target="_blank" rel="noopener noreferrer" className="font-medium text-[#546A7A] hover:text-[#546A7A] flex items-center gap-1">
                            {customer.website}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                      {customer.taxId && (
                        <div className="flex justify-between">
                          <span className="text-[#5D6E73]">Tax ID:</span>
                          <span className="font-medium text-[#546A7A]">{customer.taxId}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-[#5D6E73]">Created:</span>
                        <span className="font-medium text-[#546A7A]">{format(new Date(customer.createdAt), 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#5D6E73]">Last Updated:</span>
                        <span className="font-medium text-[#546A7A]">{format(new Date(customer.updatedAt), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                  </div>

                  {customer.notes && (
                    <div className="bg-[#EEC1BF]/10 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-[#5D6E73] mb-2">
                        Notes
                      </h3>
                      <p className="text-sm text-[#5D6E73] leading-relaxed">
                        {customer.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contacts Section */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-[#A2B9AF]/10 to-[#A2B9AF]/10">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-lg">
                  <Users className="h-5 w-5 mr-2 text-[#4F6A64]" />
                  Contacts
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge className="bg-[#A2B9AF]/20 text-[#4F6A64]">
                    {customer._count.contacts} contact{customer._count.contacts !== 1 ? 's' : ''}
                  </Badge>
                  <Button 
                    size="sm" 
                    className="bg-[#4F6A64] hover:bg-[#4F6A64] text-white"
                    onClick={() => router.push(`/expert/customers/${customer.id}/contacts/new`)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {customer.contacts?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.contacts.map((contact: Contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">{contact.name}</TableCell>
                        <TableCell>
                          {contact.phone ? (
                            <a 
                              href={`tel:${contact.phone}`}
                              className="hover:underline hover:text-primary"
                            >
                              {contact.phone}
                            </a>
                          ) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {contact.role.replace(/_/g, ' ').toLowerCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-6">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-medium">No contacts found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add contacts to this customer to manage their information.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#96AEC2]/10 to-[#EEC1BF]/10">
              <CardTitle className="text-lg flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-[#546A7A]" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="bg-[#96AEC2]/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-[#96AEC2]/20 rounded-lg">
                      <HardDrive className="h-5 w-5 text-[#546A7A]" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-[#546A7A]">Assets</span>
                      <p className="text-xs text-[#5D6E73]">Total equipment</p>
                    </div>
                  </div>
                  <Badge className="bg-[#96AEC2]/20 text-[#546A7A] text-lg font-bold px-3 py-1">
                    {customer._count.assets}
                  </Badge>
                </div>
              </div>
              
              <div className="bg-[#CE9F6B]/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-[#CE9F6B]/20 rounded-lg">
                      <Ticket className="h-5 w-5 text-[#976E44]" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-[#546A7A]">Tickets</span>
                      <p className="text-xs text-[#5D6E73]">Support requests</p>
                    </div>
                  </div>
                  <Badge className="bg-[#CE9F6B]/20 text-[#976E44] text-lg font-bold px-3 py-1">
                    {customer._count.tickets}
                  </Badge>
                </div>
              </div>
              
              <div className="bg-[#A2B9AF]/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-[#A2B9AF]/20 rounded-lg">
                      <Users className="h-5 w-5 text-[#4F6A64]" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-[#546A7A]">Contacts</span>
                      <p className="text-xs text-[#5D6E73]">People</p>
                    </div>
                  </div>
                  <Badge className="bg-[#A2B9AF]/20 text-[#4F6A64] text-lg font-bold px-3 py-1">
                    {customer._count.contacts}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assets Section */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/10">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-lg">
                  <HardDrive className="h-5 w-5 mr-2 text-[#546A7A]" />
                  Assets
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge className="bg-[#96AEC2]/20 text-[#546A7A]">
                    {customer._count.assets} asset{customer._count.assets !== 1 ? 's' : ''}
                  </Badge>
                  <Button 
                    size="sm" 
                    className="bg-[#6F8A9D] hover:bg-[#546A7A] text-white"
                    onClick={() => router.push(`/expert/customers/${customer.id}/assets/new`)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {customer.assets && customer.assets.length > 0 ? (
                <div className="space-y-4">
                  {customer.assets.slice(0, 3).map((asset: any) => (
                    <Link 
                      key={asset.id} 
                      href={`/expert/customers/${customer.id}/assets`}
                      className="block border border-[#92A2A5] rounded-lg p-6 hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] transition-all duration-200 shadow-sm"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className="p-3 bg-[#96AEC2]/20 rounded-lg">
                            <HardDrive className="h-5 w-5 text-[#546A7A]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[#546A7A] text-base truncate" title={asset.serialNo}>
                              {asset.serialNo || 'N/A'}
                            </p>
                            <p className="text-sm text-[#5D6E73] mt-1 break-words" title={asset.model}>
                              {asset.model || 'No model specified'}
                            </p>
                            {asset.location && (
                              <p className="text-xs text-[#AEBFC3]0 mt-1 flex items-center">
                                <MapPin className="h-3 w-3 mr-1" />
                                {asset.location}
                              </p>
                            )}
                            {asset.purchaseDate && (
                              <p className="text-xs text-[#AEBFC3]0 mt-1 flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                Purchased: {format(new Date(asset.purchaseDate), 'MMM dd, yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2 ml-4">
                          <Badge className={`${
                            asset.status === 'ACTIVE' ? 'bg-[#A2B9AF]/20 text-[#4F6A64]' :
                            asset.status === 'INACTIVE' ? 'bg-[#AEBFC3]/20 text-[#546A7A]' :
                            asset.status === 'MAINTENANCE' ? 'bg-[#CE9F6B]/20 text-[#976E44]' :
                            'bg-[#E17F70]/20 text-[#75242D]'
                          }`}>
                            {asset.status}
                          </Badge>
                          {asset.warrantyEnd && (
                            <div className="text-xs text-[#AEBFC3]0 text-right">
                              <p>Warranty until:</p>
                              <p className="font-medium">{format(new Date(asset.warrantyEnd), 'MMM dd, yyyy')}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {customer.assets.length > 3 && (
                    <Button 
                      variant="ghost" 
                      className="w-full mt-2"
                      onClick={() => router.push(`/expert/customers/${customer.id}/assets`)}
                    >
                      View all assets
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <HardDrive className="mx-auto h-10 w-10 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-medium">No assets found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add assets to this customer to track their equipment.
                  </p>
                  <Button 
                    className="mt-4 bg-[#6F8A9D] hover:bg-[#546A7A] text-white" 
                    size="sm" 
                    onClick={() => router.push(`/expert/customers/${customer.id}/assets/new`)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add First Asset
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
