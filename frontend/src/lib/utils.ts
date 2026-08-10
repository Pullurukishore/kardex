import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.substring(0, length)}...` : str;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

export function formatEnumValue(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatLargeNumber(v: number): string {
  if (v === 0) return '₹0'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  
  let val: string;
  let unit = '';
  
  if (abs >= 10000000) {
    val = (abs / 10000000).toFixed(2);
    unit = ' Cr';
  } else if (abs >= 100000) {
    val = (abs / 100000).toFixed(2);
    unit = ' L';
  } else if (abs >= 1000) {
    val = (abs / 1000).toFixed(1);
    unit = ' K';
  } else {
    val = abs.toFixed(0);
  }
  
  return `${sign}₹${parseFloat(val)}${unit}`;
}

export function getCustomerColorClass(customerName: string): string {
  if (!customerName) return 'from-[#82A094] to-[#4F6A64]';
  
  // Simple hashing algorithm to get a stable index
  let hash = 0;
  for (let i = 0; i < customerName.length; i++) {
    hash = customerName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    'from-[#6F8A9D] to-[#546A7A]', // kardex-blue
    'from-[#82A094] to-[#4F6A64]', // kardex-green
    'from-[#92A2A5] to-[#5D6E73]', // kardex-grey
    'from-[#979796] to-[#757777]', // kardex-silver
    'from-[#E17F70] to-[#9E3B47]', // kardex-red
    'from-[#CE9F6B] to-[#976E44]', // kardex-sand
  ];
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}
