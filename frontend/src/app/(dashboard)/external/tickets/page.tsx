import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { getTickets, calculateTicketStats } from '@/lib/server/ticket';
import ExternalTicketClient from '@/components/ticket/ExternalTicketClient';
import Link from 'next/link';

type SearchParams = {
  status?: string;
  priority?: string;
  search?: string;
  page?: string;
  limit?: string;
  view?: 'all' | 'open' | 'in-progress' | 'closed';
};

type Props = {
  params: Promise<any>;
  searchParams: Promise<SearchParams>;
};

export default async function ExternalTicketsPage({ params, searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const currentPage = parseInt(resolvedSearchParams.page || '1');
  const currentLimit = parseInt(resolvedSearchParams.limit || '100');
  
  // Filter out empty parameters to avoid validation errors
  const filters: any = {
    page: currentPage,
    limit: currentLimit,
    view: 'all' as const,
  };
  
  // Only add non-empty parameters
  if (resolvedSearchParams.status && resolvedSearchParams.status !== '') {
    filters.status = resolvedSearchParams.status;
  }
  if (resolvedSearchParams.priority && resolvedSearchParams.priority !== '') {
    filters.priority = resolvedSearchParams.priority;
  }
  if (resolvedSearchParams.search && resolvedSearchParams.search !== '') {
    filters.search = resolvedSearchParams.search;
  }

  let ticketsData;
  let error = null;
  
  try {
    ticketsData = await getTickets(filters);
  } catch (err) {
    error = 'Failed to load tickets. Please try again.';
    ticketsData = { data: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 1 } };
  }
  
  const { data: tickets, pagination } = ticketsData;
  const stats = calculateTicketStats(tickets);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header with Gradient - Mobile Responsive */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-[#9E3B47] via-[#976E44] to-red-800 p-4 md:p-6 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative header-mobile">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Support Tickets</h1>
            <p className="text-[#E17F70] text-sm md:text-base">
              Manage and track all support tickets across your organization
            </p>
          </div>
          <Link href="/external/tickets/create">
            <Button className="bg-white text-[#9E3B47] hover:bg-[#E17F70]/10 shadow-lg btn-touch">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">New Ticket</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* External Ticket Client - No Actions, No Filters */}
      <ExternalTicketClient 
        initialTickets={tickets}
        initialStats={stats}
        searchParams={{
          status: filters.status,
          priority: filters.priority,
          search: filters.search,
          page: resolvedSearchParams.page,
          limit: resolvedSearchParams.limit,
          view: filters.view,
        }}
      />
    </div>
  );
}