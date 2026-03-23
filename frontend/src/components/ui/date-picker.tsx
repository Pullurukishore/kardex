'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar, type DateRange } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { Matcher } from 'react-day-picker';

interface DatePickerProps {
  selected: DateRange | undefined;
  onSelect: (range: DateRange | undefined) => void;
  className?: string;
  buttonClassName?: string;
  placeholder?: string;
  mode?: 'single' | 'range';
  disabled?: Matcher | Matcher[];
}

export function DatePicker({
  selected,
  onSelect,
  className,
  buttonClassName,
  placeholder = "Pick a date",
  mode = 'range',
  disabled,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSelect = (range: DateRange | Date | undefined) => {
    if (!range) {
      onSelect(undefined);
      return;
    }
    
    if ('from' in range && 'to' in range) {
      onSelect(range);
    } else if (range instanceof Date) {
      onSelect({ from: range, to: range });
    }
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-full justify-start text-left font-bold border-2 transition-all shadow-sm',
              !selected?.from ? 'text-[#92A2A5] border-[#AEBFC3]/30 bg-white hover:bg-[#96AEC2]/5' : 'text-[#546A7A] border-[#6F8A9D]/50 bg-gradient-to-r from-[#6F8A9D]/5 to-transparent',
              buttonClassName
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selected?.from ? (
              selected.to ? (
                <>
                  {format(selected.from, 'LLL dd, y')} -{' '}
                  {format(selected.to, 'LLL dd, y')}
                </>
              ) : (
                format(selected.from, 'LLL dd, y')
              )
            ) : (
              <span className="text-sm font-semibold">{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border-none bg-transparent shadow-none" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={selected?.from}
            selected={selected}
            onSelect={handleSelect}
            numberOfMonths={2}
            disabled={disabled as any}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
