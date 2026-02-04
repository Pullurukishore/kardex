"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { MapPin, CheckCircle, AlertTriangle } from 'lucide-react';

export interface SimpleLocationData {
  latitude: number;
  longitude: number;
  address: string;
  accuracy: number;
  timestamp: number;
  source: 'manual';
}

interface SimpleAddressEntryProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelect: (location: SimpleLocationData) => void;
  title?: string;
  description?: string;
  gpsRetryCount?: number;
}

const SimpleAddressEntry: React.FC<SimpleAddressEntryProps> = ({
  isOpen,
  onClose,
  onLocationSelect,
  title = "📍 Enter Your Location",
  description = "GPS signal is weak. Please type your current address.",
  gpsRetryCount = 0
}) => {
  const [address, setAddress] = useState<string>('');
  const { toast } = useToast();

  const handleConfirm = () => {
    if (!address.trim()) {
      toast({
        title: "Address Required",
        description: "Please enter your current address.",
        variant: "destructive",
      });
      return;
    }

    // Simple approach: Use default coordinates with user's typed address
    // The address is what matters for records - coordinates are just for schema compliance
    const locationData: SimpleLocationData = {
      latitude: 12.9716,  // Default: Bangalore center
      longitude: 77.5946, // Default: Bangalore center
      address: address.trim(),
      accuracy: 500, // Manual entry gets lower accuracy indicator
      timestamp: Date.now(),
      source: 'manual'
    };

    onLocationSelect(locationData);
    onClose();
    setAddress('');
    
    toast({
      title: "Address Confirmed",
      description: "Your location has been set successfully.",
    });
  };

  const handleClose = () => {
    setAddress('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#546A7A]" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* GPS Retry Info */}
          {gpsRetryCount > 0 && (
            <div className="bg-[#EEC1BF]/10 border border-[#CE9F6B] rounded-lg p-3">
              <div className="flex items-center gap-2 text-[#976E44] text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">GPS Signal Issues</span>
              </div>
              <p className="text-[#976E44] text-sm mt-1">
                Tried GPS {gpsRetryCount} times. Please enter your address manually.
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-[#96AEC2]/10 border border-[#96AEC2] rounded-lg p-3">
            <div className="text-[#546A7A] text-sm font-medium mb-2">
              ✍️ Quick & Simple
            </div>
            <div className="text-[#546A7A] text-sm space-y-1">
              <div>• Type your current address below</div>
              <div>• Include building/office name if applicable</div>
              <div>• Click confirm to complete</div>
            </div>
          </div>

          {/* Address Input */}
          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-medium">
              📍 Your Current Address
            </Label>
            <Input
              id="address"
              placeholder="e.g., ABC Office, 123 MG Road, Bangalore"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleConfirm()}
              className="text-base min-h-[48px] px-4"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <p className="text-xs text-[#AEBFC3]0">
              Be as specific as possible for better records
            </p>
          </div>

          {/* Preview */}
          {address.trim() && (
            <div className="bg-[#A2B9AF]/10 border border-[#A2B9AF] rounded-lg p-3">
              <div className="flex items-start gap-3">
                <div className="bg-[#A2B9AF]/20 rounded-full p-1">
                  <CheckCircle className="h-4 w-4 text-[#4F6A64]" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[#4F6A64] text-sm">✅ Address Ready</div>
                  <div className="text-sm text-[#4F6A64] mt-1">
                    {address}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-[#A2B9AF]/20 text-[#4F6A64] border-[#82A094] text-xs">
                      <MapPin className="h-3 w-3 mr-1" />
                      Manual Address
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t">
            <div className="text-xs text-[#AEBFC3]0 hidden sm:block">
              {address.trim() ? '✅ Ready to proceed' : '📝 Please enter your address'}
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={handleClose} className="flex-1 sm:flex-none min-h-[48px]">
                Cancel
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={!address.trim()}
                className={`flex-1 sm:flex-none min-h-[48px] ${address.trim() ? 'bg-[#4F6A64] hover:bg-[#4F6A64]' : 'bg-[#979796]'} text-white font-medium`}
              >
                {address.trim() ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Address
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Enter Address First
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleAddressEntry;
