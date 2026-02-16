"use client";

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { fetchCustomer } from '@/services/customer.service';
import type { CustomerFormData, Customer as ApiCustomer } from '@/types/customer';

type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

// Define the customer type based on the API response
interface Customer extends ApiCustomer {
  // Add any additional fields needed for the form
}

// Dynamically import the CustomerFormComponent with SSR disabled
const CustomerFormComponent = dynamic(
  () => import('@/components/customer/CustomerFormComponent'),
  { ssr: false }
);

export default function EditCustomerPage() {
  const { id } = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCustomer = async () => {
      try {
        const customerId = Array.isArray(id) ? id[0] : id;
        if (!customerId) {
          throw new Error('Customer ID is required');
        }
        const data = await fetchCustomer(Number(customerId));
        setCustomer(data as unknown as Customer);
      } catch (error) {
        router.push('/admin/customers');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadCustomer();
    }
  }, [id, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!customer) {
    return <div>Customer not found</div>;
  }

  // Transform API data to match form data format
  const formData: CustomerFormData = {
    companyName: customer.companyName || '',
    industry: customer.industry,
    address: customer.address,
    status: customer.isActive ? 'ACTIVE' : 'INACTIVE', // Derive status from isActive boolean
    serviceZoneId: customer.serviceZoneId || 0, // Ensure serviceZoneId is not undefined
    // Contact information - map from first contact if available
    contactName: customer.contacts?.[0]?.name || '',
    contactPhone: customer.contacts?.[0]?.phone || '',
    contactEmail: customer.contacts?.[0]?.email || '',
  };

  return <CustomerFormComponent customer={formData} customerId={customer.id} />;
}