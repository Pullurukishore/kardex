'use client'

import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem 
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Eye, Pencil as Edit } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface TicketTableActionsProps {
  ticketId: string | number;
  basePath: string;
  detailPathSuffix: string;
}

export default function TicketTableActions({ ticketId, basePath, detailPathSuffix }: TicketTableActionsProps) {
  const router = useRouter()
  
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
