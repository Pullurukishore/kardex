
export const TICKET_STATUSES = [
    'All Status',
    'OPEN',
    'ASSIGNED',
    'IN_PROGRESS',
    'ONSITE_VISIT_PLANNED',
    'ONSITE_VISIT',
    'CLOSED_PENDING',
    'CLOSED',
    'SPARE_PARTS_NEEDED',
    'SPARE_PARTS_BOOKED',
    'SPARE_PARTS_DELIVERED',
    'PO_NEEDED',
    'PO_RECEIVED'
];

export const TICKET_PRIORITIES = ['All Priority', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const getStatusStyle = (status: string) => {
    switch (status) {
        case 'OPEN':
            return 'bg-[#96AEC2] text-white';
        case 'ASSIGNED':
            return 'bg-[#6F8A9D] text-white';
        case 'IN_PROGRESS':
            return 'bg-[#546A7A] text-white';
        case 'ONSITE_VISIT_PLANNED':
            return 'bg-[#A2B9AF] text-white';
        case 'ONSITE_VISIT':
            return 'bg-[#82A094] text-white';
        case 'ONSITE_VISIT_STARTED':
            return 'bg-[#A2B9AF] text-white';
        case 'ONSITE_VISIT_REACHED':
            return 'bg-[#82A094] text-white';
        case 'ONSITE_VISIT_IN_PROGRESS':
            return 'bg-[#EEC18F] text-white';
        case 'ONSITE_VISIT_RESOLVED':
            return 'bg-[#4F6A64] text-white';
        case 'ONSITE_VISIT_PENDING':
            return 'bg-[#CE9F6B] text-white';
        case 'ONSITE_VISIT_COMPLETED':
            return 'bg-[#4F6A64] text-white';
        case 'SPARE_PARTS_NEEDED':
            return 'bg-[#E17F70] text-white';
        case 'SPARE_PARTS_BOOKED':
            return 'bg-[#CE9F6B] text-white';
        case 'SPARE_PARTS_DELIVERED':
            return 'bg-[#82A094] text-white';
        case 'PO_NEEDED':
            return 'bg-[#976E44] text-white';
        case 'PO_REACHED':
            return 'bg-[#6F8A9D] text-white';
        case 'PO_RECEIVED':
            return 'bg-[#546A7A] text-white';
        case 'CLOSED_PENDING':
            return 'bg-[#EEC18F] text-white';
        case 'CLOSED':
            return 'bg-[#979796] text-white';
        case 'CANCELLED':
            return 'bg-[#9E3B47] text-white';
        case 'RESOLVED':
            return 'bg-[#82A094] text-white';
        case 'REOPENED':
            return 'bg-[#6F8A9D] text-white';
        case 'ON_HOLD':
            return 'bg-[#757777] text-white';
        case 'ESCALATED':
            return 'bg-[#E17F70] text-white';
        case 'WAITING_CUSTOMER':
            return 'bg-[#CE9F6B] text-white';
        case 'PENDING':
            return 'bg-[#EEC18F] text-white';
        default:
            return 'bg-[#979796] text-white';
    }
};

export const getPriorityStyle = (priority: string) => {
    switch (priority) {
        case 'CRITICAL':
            return 'bg-[#9E3B47]/20 text-[#75242D] border-[#9E3B47]';
        case 'HIGH':
            return 'bg-[#E17F70]/20 text-[#9E3B47] border-[#E17F70]';
        case 'MEDIUM':
            return 'bg-[#EEC18F]/20 text-[#976E44] border-[#EEC18F]';
        case 'LOW':
            return 'bg-[#A2B9AF]/20 text-[#4F6A64] border-[#A2B9AF]';
        default:
            return 'bg-[#979796]/20 text-[#757777] border-[#979796]';
    }
};
