'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-4 bg-white/60 backdrop-blur-xl border-2 border-[#AEBFC3]/20 rounded-2xl shadow-2xl', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        caption: 'flex justify-center pt-2 pb-2 relative items-center',
        caption_label: 'text-sm font-bold tracking-tight text-[#546A7A]',
        nav: 'space-x-1 flex items-center',
        nav_button: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-white/50 border-2 border-[#AEBFC3]/30 p-0 text-[#546A7A] hover:bg-[#6F8A9D]/10 hover:border-[#6F8A9D]/30 transition-all shadow-sm rounded-lg'
        ),
        nav_button_previous: 'absolute left-1',
        nav_button_next: 'absolute right-1',
        table: 'w-full border-collapse space-y-1',
        head_row: 'flex',
        head_cell:
          'text-[#92A2A5] rounded-md w-9 font-bold text-[0.8rem] uppercase tracking-wider',
        row: 'flex w-full mt-2',
        cell: 'text-center text-sm p-0 pos-relative [&:has([aria-selected])]:bg-[#CE9F6B]/10 first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg focus-within:relative focus-within:z-20',
        day: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-medium text-[#546A7A] aria-selected:opacity-100 hover:bg-[#6F8A9D]/10 hover:text-[#546A7A] transition-all rounded-lg'
        ),
        day_selected:
          'bg-gradient-to-br from-[#CE9F6B] to-[#976E44] text-white hover:from-[#CE9F6B] hover:to-[#976E44] hover:text-white focus:from-[#CE9F6B] focus:to-[#976E44] focus:text-white shadow-md shadow-[#CE9F6B]/30 font-bold',
        day_today: 'bg-[#AEBFC3]/20 text-[#546A7A] font-bold ring-2 ring-[#AEBFC3]/40',
        day_outside: 'text-[#92A2A5] opacity-50',
        day_disabled: 'text-[#92A2A5] opacity-50',
        day_range_middle:
          'aria-selected:bg-[#CE9F6B]/15 aria-selected:text-[#976E44] aria-selected:shadow-none aria-selected:font-bold rounded-none',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...props }) => {
          if (orientation === 'left') {
            return (
              <span className="h-4 w-4" {...props}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </span>
            );
          }
          return (
            <span className="h-4 w-4" {...props}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
          );
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar as CalendarPrimitive };

export * from 'react-day-picker';
