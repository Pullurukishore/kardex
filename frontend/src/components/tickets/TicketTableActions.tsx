'use client'

import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Eye, Pencil as Edit, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { apiService } from '@/services/api'
import { toast } from 'sonner'

interface TicketTableActionsProps {
  ticketId: string | number;
  basePath: string;
  detailPathSuffix: string;
  showDelete?: boolean;
  onDeleteSuccess?: () => void;
}

export default function TicketTableActions({ 
  ticketId, 
  basePath, 
  detailPathSuffix,
  showDelete = false,
  onDeleteSuccess
}: TicketTableActionsProps) {
  const router = useRouter()

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const confirmed = window.confirm('Are you sure you want to delete this ticket? This action cannot be undone.')
    if (!confirmed) return

    try {
      await apiService.deleteTicket(Number(ticketId))
      toast.success('Ticket deleted successfully')
      if (onDeleteSuccess) {
        onDeleteSuccess()
      }
    } catch (error: any) {
      console.error('Failed to delete ticket:', error)
      toast.error(error.response?.data?.error || 'Failed to delete ticket')
    }
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4 text-[#5D6E73]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl shadow-xl">
        <DropdownMenuItem onClick={() => router.push(`${basePath}/${ticketId}${detailPathSuffix}`)}>
          <Eye className="h-4 w-4 mr-2" /> View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`${basePath}/${ticketId}/edit`)}>
          <Edit className="h-4 w-4 mr-2" /> Edit
        </DropdownMenuItem>
        {showDelete && (
          <>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem 
              onClick={handleDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50/50 focus:text-red-700 focus:bg-red-50/50 cursor-pointer"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
