'use client';

import { Control } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, FileText, MapPin, Phone, Type, AlignLeft, Flag, Globe } from 'lucide-react';

interface Zone {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
}

interface TicketBasicInfoFormProps {
  control: Control<any>;
  zones: Zone[];
  isSubmitting: boolean;
  hideZoneSelector?: boolean;
}

export function TicketBasicInfoForm({ control, zones, isSubmitting, hideZoneSelector = false }: TicketBasicInfoFormProps) {
  return (
    <Card className="shadow-xl border-0 bg-white overflow-hidden">
      {/* Top accent bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D]"></div>
      
      <CardHeader className="bg-gradient-to-br from-[#96AEC2]/10 via-[#6F8A9D]/10/50 to-[#6F8A9D]/10/30 border-b border-[#96AEC2]/30/50 pb-4">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center shadow-lg ring-2 ring-blue-100">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br from-[#CE9F6B] to-[#CE9F6B] flex items-center justify-center shadow">
              <span className="text-xs font-bold text-white">1</span>
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-[#546A7A]">Ticket Information</CardTitle>
            <CardDescription className="text-[#AEBFC3]0 mt-1">Fill in the basic details about the support ticket</CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-8">
        {/* Title Field - Full Width */}
        <FormField
          control={control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2 text-base font-semibold text-[#5D6E73]">
                <div className="h-7 w-7 rounded-lg bg-[#96AEC2]/20 flex items-center justify-center">
                  <Type className="h-4 w-4 text-[#546A7A]" />
                </div>
                Ticket Title
                <span className="text-[#E17F70] ml-1">*</span>
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder="e.g., Machine not starting, Error code E501, Routine maintenance needed..." 
                  {...field} 
                  onChange={(e) => field.onChange(e.target.value)}
                  disabled={isSubmitting}
                  className="h-12 text-base border-[#92A2A5] focus:ring-2 focus:ring-[#96AEC2] focus:border-[#6F8A9D] transition-all placeholder:text-[#979796]"
                />
              </FormControl>
              <FormDescription className="text-[#AEBFC3]0 text-sm">
                Provide a brief, descriptive title for quick identification
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Description Field - Full Width */}
        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2 text-base font-semibold text-[#5D6E73]">
                <div className="h-7 w-7 rounded-lg bg-[#546A7A]/20 flex items-center justify-center">
                  <AlignLeft className="h-4 w-4 text-[#546A7A]" />
                </div>
                Description
                <span className="text-[#E17F70] ml-1">*</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the issue in detail:&#10;• What happened?&#10;• When did it start?&#10;• Any error messages or codes?&#10;• Steps already tried to fix it?"
                  className="min-h-[140px] text-base border-[#92A2A5] focus:ring-2 focus:ring-[#6F8A9D] focus:border-[#6F8A9D] transition-all resize-none placeholder:text-[#979796]"
                  disabled={isSubmitting}
                  {...field}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </FormControl>
              <FormDescription className="text-[#AEBFC3]0 text-sm">
                The more details you provide, the faster we can resolve your issue
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Call Type and Priority Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Call Type */}
          <FormField
            control={control}
            name="callType"
            render={({ field }) => (
              <FormItem className="bg-gradient-to-br from-[#A2B9AF]/10/50 to-[#A2B9AF]/10/30 p-5 rounded-xl border border-[#A2B9AF]/30">
                <FormLabel className="flex items-center gap-2 text-base font-semibold text-[#5D6E73]">
                  <div className="h-7 w-7 rounded-lg bg-[#A2B9AF]/20 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-[#4F6A64]" />
                  </div>
                  Call Type
                  <span className="text-[#E17F70] ml-1">*</span>
                </FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value}
                  disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 text-base bg-white border-[#92A2A5] focus:ring-2 focus:ring-[#82A094] focus:border-[#82A094]">
                      <SelectValue placeholder="Select contract status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="UNDER_MAINTENANCE_CONTRACT" className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-[#96AEC2]/100 ring-2 ring-[#96AEC2]/50"></div>
                        <div>
                          <span className="font-medium text-[#546A7A]">Under Maintenance Contract</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Covered under service agreement</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="NOT_UNDER_CONTRACT" className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-[#CE9F6B]/100 ring-2 ring-orange-200"></div>
                        <div>
                          <span className="font-medium text-[#976E44]">Not Under Contract</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Billable service call</p>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Priority */}
          <FormField
            control={control}
            name="priority"
            render={({ field }) => (
              <FormItem className="bg-gradient-to-br from-[#EEC1BF]/10/50 to-[#EEC1BF]/10/30 p-5 rounded-xl border border-[#EEC1BF]/30">
                <FormLabel className="flex items-center gap-2 text-base font-semibold text-[#5D6E73]">
                  <div className="h-7 w-7 rounded-lg bg-[#CE9F6B]/20 flex items-center justify-center">
                    <Flag className="h-4 w-4 text-[#976E44]" />
                  </div>
                  Priority Level
                  <span className="text-[#E17F70] ml-1">*</span>
                </FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value}
                  disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 text-base bg-white border-[#92A2A5] focus:ring-2 focus:ring-[#CE9F6B] focus:border-[#CE9F6B]">
                      <SelectValue placeholder="Select urgency level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="LOW" className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-[#A2B9AF]/100 ring-2 ring-[#A2B9AF]/50"></div>
                        <div>
                          <span className="font-medium text-[#4F6A64]">Low Priority</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Can wait, no immediate impact</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="MEDIUM" className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-[#EEC1BF]/100 ring-2 ring-yellow-200"></div>
                        <div>
                          <span className="font-medium text-[#976E44]">Medium Priority</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Important, affects workflow</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="HIGH" className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-[#E17F70]/100 ring-2 ring-[#E17F70]/50 animate-pulse"></div>
                        <div>
                          <span className="font-medium text-[#75242D]">High Priority</span>
                          <p className="text-xs text-[#AEBFC3]0 mt-0.5">Urgent, production stopped</p>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {/* Service Zone - Full Width */}
        <FormField
          control={control}
          name="zoneId"
          render={({ field }) => {
            const selectedZone = zones.find(zone => zone.id === field.value);
            
            return (
              <FormItem className="bg-gradient-to-br from-[#96AEC2]/10/50 to-[#96AEC2]/10/30 p-5 rounded-xl border border-[#96AEC2]/30">
                <FormLabel className="flex items-center gap-2 text-base font-semibold text-[#5D6E73]">
                  <div className="h-7 w-7 rounded-lg bg-[#96AEC2]/20 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-[#546A7A]" />
                  </div>
                  Service Zone
                  <span className="text-[#E17F70] ml-1">*</span>
                </FormLabel>
                
                {hideZoneSelector ? (
                  <div className="flex items-center gap-3 p-4 bg-white border border-[#92A2A5] rounded-lg">
                    <MapPin className="h-5 w-5 text-[#6F8A9D] flex-shrink-0" />
                    <span className="font-medium text-[#5D6E73]">
                      {selectedZone?.name || 'No zone selected'}
                    </span>
                  </div>
                ) : (
                  <Select 
                    onValueChange={(value) => field.onChange(value === 'all' ? 'all' : Number(value))} 
                    value={field.value?.toString()}
                    disabled={isSubmitting || zones.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className="h-12 text-base bg-white border-[#92A2A5] focus:ring-2 focus:ring-[#96AEC2] focus:border-[#6F8A9D]">
                        <SelectValue placeholder={zones.length === 0 ? 'No zones available' : 'Select the service zone for this ticket'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.isArray(zones) && zones.length > 0 ? (
                        <>
                          {zones.length > 1 && (
                            <SelectItem key="all" value="all" className="py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center">
                                  <Globe className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                  <span className="font-medium">All Zones</span>
                                  <p className="text-xs text-[#AEBFC3]0 mt-0.5">Show customers from all service zones</p>
                                </div>
                              </div>
                            </SelectItem>
                          )}
                          {zones.filter(zone => zone.isActive).map((zone) => (
                            <SelectItem key={zone.id} value={zone.id.toString()} className="py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center">
                                  <MapPin className="h-4 w-4 text-white" />
                                </div>
                                <span className="font-medium">{zone.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </>
                      ) : (
                        <div className="p-4 text-center text-sm text-[#AEBFC3]">
                          No active zones available
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                )}
                <FormDescription className="text-[#AEBFC3]0 text-sm">
                  Select the zone to load available customers
                </FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      </CardContent>
    </Card>
  );
}
