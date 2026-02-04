import {
    Package,
    Sparkles,
    XCircle,
    AlertTriangle
} from 'lucide-react'

export interface SparePart {
    id: number;
    name: string;
    partNumber: string;
    description?: string;
    category: string;
    basePrice: number;
    status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
    imageUrl?: string;
    createdAt: string;
    updatedAt: string;
}

export const SPARE_PART_STATUSES = ['All Status', 'ACTIVE', 'INACTIVE', 'DISCONTINUED'];
export const SPARE_PART_CATEGORIES = ['All Categories', 'Hardware', 'Software', 'Consumables', 'Tools', 'Accessories'];

export const getStatusColor = (status: string) => {
    switch (status) {
        case 'ACTIVE':
            return 'bg-[#A2B9AF]/20 text-[#4F6A64] border-[#A2B9AF]';
        case 'INACTIVE':
            return 'bg-[#AEBFC3]/20 text-[#546A7A] border-[#AEBFC3]';
        case 'DISCONTINUED':
            return 'bg-[#E17F70]/20 text-[#9E3B47] border-[#E17F70]';
        default:
            return 'bg-gray-100 text-gray-600 border-gray-200';
    }
};

export const getCategoryColor = (category: string) => {
    switch (category) {
        case 'Hardware':
            return 'bg-[#96AEC2]/20 text-[#546A7A] border-[#96AEC2]';
        case 'Software':
            return 'bg-[#A2B9AF]/20 text-[#4F6A64] border-[#A2B9AF]';
        case 'Consumables':
            return 'bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]';
        case 'Tools':
            return 'bg-[#6F8A9D]/20 text-[#546A7A] border-[#6F8A9D]';
        case 'Accessories':
            return 'bg-[#AEBFC3]/20 text-[#546A7A] border-[#AEBFC3]';
        default:
            return 'bg-gray-100 text-gray-600 border-gray-200';
    }
};

export const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(value);
};
