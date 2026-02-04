"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { 
  MapPin, 
  Navigation, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  RefreshCw,
  Target
} from 'lucide-react';
import { useEnhancedLocation, LocationData } from '@/hooks/useEnhancedLocation';
import SimpleAddressEntry from '@/components/location/SimpleAddressEntry';
import { cn } from '@/lib/utils';

interface EnhancedLocationCaptureProps {
  onLocationCapture: (location: LocationData) => void;
  previousLocation?: LocationData;
  required?: boolean;
  className?: string;
  autoCapture?: boolean;
  enableJumpDetection?: boolean;
}

const EnhancedLocationCapture: React.FC<EnhancedLocationCaptureProps> = ({
  onLocationCapture,
  previousLocation,
  required = true,
  className,
  autoCapture = false,
  enableJumpDetection = true
}) => {
  const { toast } = useToast();
  
  // Elapsed time counter for GPS capture
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  
  const {
    isLoading,
    isManualAddressOpen,
    currentLocation,
    error,
    lastAttempt,
    gpsRetryCount,
    captureGPSLocation,
    handleManualAddressSelect,
    openManualAddress,
    closeManualAddress,
    resetLocation,
    getLocationQuality,
    hasValidLocation,
    isGPSLocation,
    isManualLocation,
    locationQuality
  } = useEnhancedLocation({
    maxAccuracy: 2000, // 2km accuracy threshold (very lenient)
    maxRetries: 1, // Single attempt - no retries
    timeout: 15000,
    autoCapture,
    enableJumpDetection,
    previousLocation
  });

  // Timer for elapsed seconds during GPS capture
  React.useEffect(() => {
    if (isLoading) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsedSeconds(0);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isLoading]);

  // Debug logging for GPS capture attempts
  React.useEffect(() => {
    if (lastAttempt && lastAttempt.location) {
      console.log(`EnhancedLocationCapture: Last attempt accuracy=${lastAttempt.location.accuracy}m, success=${lastAttempt.success}`);
      console.log(`EnhancedLocationCapture: GPS retry count=${gpsRetryCount}`);
      
      // Show warning if present
      if (lastAttempt.success && lastAttempt.warning) {
        toast({
          title: "GPS Accuracy Notice",
          description: lastAttempt.warning,
          variant: "default",
        });
      }
    }
  }, [lastAttempt, gpsRetryCount]);

  // Handle location capture success - use ref to prevent infinite loops
  const lastNotifiedLocationRef = React.useRef<LocationData | null>(null);
  
  React.useEffect(() => {
    if (currentLocation && currentLocation !== lastNotifiedLocationRef.current) {
      lastNotifiedLocationRef.current = currentLocation;
      onLocationCapture(currentLocation);
    }
  }, [currentLocation, onLocationCapture]);

  const handleCaptureClick = async () => {
    await captureGPSLocation();
  };

  const handleRetry = () => {
    resetLocation();
    captureGPSLocation();
  };

  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-4 w-4 animate-spin text-[#546A7A]" />;
    }
    
    if (hasValidLocation) {
      return <CheckCircle className="h-4 w-4 text-[#4F6A64]" />;
    }
    
    if (error) {
      return <AlertTriangle className="h-4 w-4 text-[#9E3B47]" />;
    }
    
    return <MapPin className="h-4 w-4 text-[#979796]" />;
  };

  const getStatusText = () => {
    if (isLoading) {
      // Show elapsed time so user knows app is working
      const mode = elapsedSeconds < 10 ? 'GPS' : 'Network';
      return `Capturing ${mode} location... ${elapsedSeconds}s`;
    }
    
    if (hasValidLocation) {
      return isManualLocation ? 'Manual location set' : 'GPS location captured';
    }
    
    if (error) {
      return error;
    }
    
    return required ? 'Location required' : 'Location not captured';
  };

  const getLocationDisplay = () => {
    if (!currentLocation) return null;

    const quality = getLocationQuality(currentLocation);
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Location Details</span>
          <Badge 
            variant={isManualLocation ? "default" : "secondary"}
            className={cn(
              "text-xs",
              isManualLocation && "bg-[#96AEC2]/20 text-[#546A7A]",
              isGPSLocation && quality.level === 'excellent' && "bg-[#A2B9AF]/20 text-[#4F6A64]",
              isGPSLocation && quality.level === 'good' && "bg-[#96AEC2]/20 text-[#546A7A]",
              isGPSLocation && quality.level === 'fair' && "bg-[#CE9F6B]/20 text-[#976E44]",
              isGPSLocation && quality.level === 'poor' && "bg-[#CE9F6B]/20 text-[#976E44]"
            )}
          >
            {isManualLocation ? (
              <>
                <Navigation className="h-3 w-3 mr-1" />
                Manual
              </>
            ) : (
              <>
                <Target className="h-3 w-3 mr-1" />
                GPS ±{Math.round(currentLocation.accuracy)}m
              </>
            )}
          </Badge>
        </div>
        
        <div className="text-sm text-[#5D6E73]">
          {currentLocation.address || `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`}
        </div>
        
        <div className="flex gap-4 text-xs text-[#AEBFC3]0">
          <span>Lat: {currentLocation.latitude.toFixed(6)}</span>
          <span>Lng: {currentLocation.longitude.toFixed(6)}</span>
          <span>{new Date(currentLocation.timestamp).toLocaleTimeString()}</span>
        </div>
        
        {locationQuality && (
          <div className={cn("text-xs", locationQuality.color)}>
            {locationQuality.description}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Status Card */}
      <Card className={cn(
        "border-2 transition-colors",
        hasValidLocation && "border-[#A2B9AF] bg-[#A2B9AF]/10",
        error && "border-[#E17F70] bg-[#E17F70]/10",
        isLoading && "border-[#96AEC2] bg-[#96AEC2]/10"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-sm font-medium">
                Location Capture {required && <span className="text-[#E17F70]">*</span>}
              </span>
            </div>
            
            {!isLoading && !hasValidLocation && (
              <Button
                size="sm"
                onClick={handleCaptureClick}
                className="bg-[#6F8A9D] hover:bg-[#546A7A] min-h-[44px] px-4"
              >
                <Target className="h-4 w-4 mr-1" />
                Capture GPS
              </Button>
            )}
            
            {hasValidLocation && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                className="min-h-[44px] px-4"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            )}
          </div>
          
          <div className="text-sm text-[#5D6E73] mb-2">
            {getStatusText()}
          </div>
          
          {getLocationDisplay()}
          
          {/* GPS Accuracy Info */}
          {lastAttempt && !lastAttempt.success && lastAttempt.location && (
            <div className="mt-3 p-2 bg-[#EEC1BF]/10 border border-[#CE9F6B] rounded text-xs">
              <div className="font-medium text-[#976E44]">GPS Available but Inaccurate</div>
              <div className="text-[#976E44]">
                Best GPS: ±{Math.round(lastAttempt.location.accuracy)}m (requires ≤2000m)
              </div>
            </div>
          )}
          
          {/* Manual Selection Option */}
          {(error || (lastAttempt && lastAttempt.requiresManualSelection)) && !isLoading && (
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={openManualAddress}
                className="w-full min-h-[48px] text-base"
              >
                <MapPin className="h-4 w-4 mr-2" />
                Select Location Manually
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Simple Address Entry */}
      <SimpleAddressEntry
        isOpen={isManualAddressOpen}
        onClose={closeManualAddress}
        onLocationSelect={handleManualAddressSelect}
        title="📍 Enter Your Location"
        description="GPS is not available. Please type your current address."
        gpsRetryCount={gpsRetryCount}
      />
    </div>
  );
};

export default EnhancedLocationCapture;
