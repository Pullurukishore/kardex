'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { DateRange as ReactDayPickerDateRange, DayPickerProps } from 'react-day-picker';

export type DateRange = ReactDayPickerDateRange;

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { CalendarPrimitive } from './calendar-primitive';

type CalendarBaseProps = Omit<DayPickerProps, 'mode' | 'selected' | 'onSelect'> & {
  disabled?: boolean;
  className?: string;
  defaultMonth?: Date;
  numberOfMonths?: number;
};

type SingleCalendarProps = CalendarBaseProps & {
  mode?: 'single';
  selected?: Date | undefined;
  onSelect?: (date: Date | undefined) => void;
};

type RangeCalendarProps = CalendarBaseProps & {
  mode: 'range';
  selected?: DateRange | undefined;
  onSelect?: (date: DateRange | undefined) => void;
};

type MultipleCalendarProps = CalendarBaseProps & {
  mode: 'multiple';
  selected?: Date[] | undefined;
  onSelect?: (date: Date[] | undefined) => void;
};

type CalendarProps = SingleCalendarProps | RangeCalendarProps | MultipleCalendarProps;

type SelectedDate = Date | DateRange | Date[] | undefined;

export function Calendar({
  selected,
  onSelect,
  disabled = false,
  className,
  mode = 'single',
  defaultMonth,
  numberOfMonths = 1,
  ...props
}: CalendarProps) {
  const [date, setDate] = React.useState<SelectedDate>(selected);

  React.useEffect(() => {
    setDate(selected);
  }, [selected]);

  const handleSelect = (newDate: SelectedDate) => {
    setDate(newDate);
    if (onSelect) {
      // Type assertion is safe here because we know the expected type based on mode
      onSelect(newDate as any);
    }
  };

  const displayDate = React.useMemo(() => {
    if (!date) return 'Pick a date';
    if (Array.isArray(date)) {
      return date.length > 0 
        ? `${date.length} date${date.length > 1 ? 's' : ''} selected`
        : 'Pick dates';
    }
    if (date instanceof Date) return format(date, 'PPP');
    if ('from' in date && date.from) {
      return date.to 
        ? `${format(date.from, 'MMM d, yyyy')} - ${format(date.to, 'MMM d, yyyy')}`
        : format(date.from, 'MMM d, yyyy');
    }
    return 'Pick a date';
  }, [date]);

  const baseProps = {
    ...props,
    disabled,
    defaultMonth,
    numberOfMonths,
  } as const;

  const renderCalendar = () => {
    const commonProps = {
      ...baseProps,
      onSelect: handleSelect,
      mode,
    };

    // Type assertion is safe because we know the type of selected matches the mode
    return <CalendarPrimitive {...commonProps} selected={date as any} />;
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-[280px] justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayDate}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border-none bg-transparent shadow-none" align="start">
          {renderCalendar()}
        </PopoverContent>
      </Popover>
    </div>
  );
}
