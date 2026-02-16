'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Camera,
  RotateCcw,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Image as ImageIcon,
  Trash2,
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CapturedPhoto {
  id: string;
  dataUrl: string;
  timestamp: string;
  filename: string;
  size: number;
}

interface PhotoCaptureProps {
  onPhotoCapture: (photos: CapturedPhoto[]) => void;
  maxPhotos?: number;
  required?: boolean;
  className?: string;
  label?: string;
  description?: string;
}

const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  onPhotoCapture,
  maxPhotos = 3,
  required = false,
  className,
  label = "Photo Verification",
  description = "Take photos or upload from gallery"
}) => {
  const { toast } = useToast();
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setIsCapturing(true);

      // Stop existing stream if any
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (error) {
      toast({
        title: 'Camera Error',
        description: 'Failed to access camera. Please check permissions.',
        variant: 'destructive',
      });
      setIsCapturing(false);
    }
  }, [facingMode, stream, toast]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  }, [stream]);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

    // Calculate approximate size
    const sizeInBytes = Math.round((dataUrl.length * 3) / 4);

    const newPhoto: CapturedPhoto = {
      id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dataUrl,
      timestamp: new Date().toISOString(),
      filename: `onsite_photo_${new Date().toISOString().split('T')[0]}_${Date.now()}.webp`,
      size: sizeInBytes
    };

    const updatedPhotos = [...capturedPhotos, newPhoto];
    setCapturedPhotos(updatedPhotos);
    onPhotoCapture(updatedPhotos);

    toast({
      title: 'Photo Captured',
      description: `Photo saved successfully (${Math.round(sizeInBytes / 1024)}KB)`,
    });

    // Stop camera after capturing if we've reached max photos
    if (updatedPhotos.length >= maxPhotos) {
      stopCamera();
    }
  }, [capturedPhotos, maxPhotos, onPhotoCapture, stopCamera, toast]);

  // Handle file upload from gallery
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxPhotos - capturedPhotos.length;
    if (remainingSlots <= 0) {
      toast({
        title: 'Maximum Photos Reached',
        description: `You can only upload up to ${maxPhotos} photos.`,
        variant: 'destructive',
      });
      return;
    }

    setIsProcessingUpload(true);

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    const newPhotos: CapturedPhoto[] = [];

    for (const file of filesToProcess) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid File',
          description: `"${file.name}" is not an image file.`,
          variant: 'destructive',
        });
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: `"${file.name}" exceeds 10MB limit.`,
          variant: 'destructive',
        });
        continue;
      }

      try {
        const dataUrl = await processImageFile(file);
        const sizeInBytes = Math.round((dataUrl.length * 3) / 4);

        newPhotos.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          dataUrl,
          timestamp: new Date().toISOString(),
          filename: `upload_${new Date().toISOString().split('T')[0]}_${Date.now()}.webp`,
          size: sizeInBytes,
        });
      } catch (err) {
        toast({
          title: 'Upload Error',
          description: `Failed to process "${file.name}".`,
          variant: 'destructive',
        });
      }
    }

    if (newPhotos.length > 0) {
      const updatedPhotos = [...capturedPhotos, ...newPhotos];
      setCapturedPhotos(updatedPhotos);
      onPhotoCapture(updatedPhotos);

      toast({
        title: 'Photos Uploaded',
        description: `${newPhotos.length} photo${newPhotos.length > 1 ? 's' : ''} uploaded successfully.`,
      });
    }

    setIsProcessingUpload(false);

    // Reset file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [capturedPhotos, maxPhotos, onPhotoCapture, toast]);

  // Process image file: resize and convert to JPEG dataUrl
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context unavailable'));
            return;
          }

          // Resize to max 1920px on the longest side
          const MAX_DIM = 1920;
          let width = img.width;
          let height = img.height;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Delete photo
  const deletePhoto = useCallback((photoId: string) => {
    const updatedPhotos = capturedPhotos.filter(photo => photo.id !== photoId);
    setCapturedPhotos(updatedPhotos);
    onPhotoCapture(updatedPhotos);

    toast({
      title: 'Photo Deleted',
      description: 'Photo removed successfully',
    });
  }, [capturedPhotos, onPhotoCapture, toast]);

  // Switch camera
  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    if (isCapturing) {
      // Restart camera with new facing mode
      setTimeout(() => startCamera(), 100);
    }
  }, [isCapturing, startCamera]);

  // Trigger file input click
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  };

  return (
    <div className={cn("bg-white rounded-xl border border-[#92A2A5] overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#AEBFC3]/30 bg-[#AEBFC3]/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#6F8A9D]/20">
            <Camera className="h-4 w-4 text-[#546A7A]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#546A7A]">{label}</span>
              {required && (
                <span className="px-2 py-0.5 text-xs font-medium text-[#9E3B47] bg-[#E17F70]/10 rounded-full">
                  Required
                </span>
              )}
            </div>
            {description && (
              <p className="text-sm text-[#AEBFC3]0 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span className="font-bold text-[#546A7A]">{capturedPhotos.length}</span>
          <span className="text-[#979796]">/</span>
          <span className="text-[#AEBFC3]0">{maxPhotos}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Hidden file input for gallery upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Camera & Upload Buttons */}
        {!isCapturing && capturedPhotos.length < maxPhotos && (
          <div className="flex gap-3">
            <Button
              onClick={startCamera}
              disabled={isProcessingUpload}
              className="flex-1 h-12 bg-[#546A7A] hover:bg-[#3d5260] text-white font-medium rounded-lg shadow-sm"
            >
              <Camera className="h-5 w-5 mr-2" />
              Open Camera
            </Button>
            <Button
              onClick={openFilePicker}
              disabled={isProcessingUpload}
              variant="outline"
              className="flex-1 h-12 border-[#6F8A9D] text-[#546A7A] hover:bg-[#6F8A9D]/10 font-medium rounded-lg"
            >
              {isProcessingUpload ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  Upload from Gallery
                </>
              )}
            </Button>
          </div>
        )}

        {/* Camera View */}
        {isCapturing && (
          <div className="space-y-3">
            <div className="relative bg-[#546A7A] rounded-xl overflow-hidden shadow-inner">
              <video
                ref={videoRef}
                className="w-full h-56 object-cover"
                playsInline
                muted
              />

              {/* Camera mode indicator */}
              <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md text-white text-xs font-medium">
                {facingMode === 'environment' ? '📷 Back' : '🤳 Front'}
              </div>

              {/* Capture button overlay */}
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-center gap-3">
                <button
                  onClick={switchCamera}
                  className="w-10 h-10 flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>

                <button
                  onClick={capturePhoto}
                  disabled={capturedPhotos.length >= maxPhotos}
                  className="w-16 h-16 flex items-center justify-center bg-white rounded-full shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
                >
                  <div className="w-14 h-14 flex items-center justify-center bg-[#546A7A] rounded-full">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                </button>

                <button
                  onClick={stopCamera}
                  className="w-10 h-10 flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Captured Photos Grid */}
        {capturedPhotos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center bg-[#A2B9AF]/20 rounded-full">
                <Check className="h-3 w-3 text-[#4F6A64]" />
              </div>
              <span className="text-sm font-medium text-[#5D6E73]">
                {capturedPhotos.length} photo{capturedPhotos.length > 1 ? 's' : ''} added
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {capturedPhotos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="relative flex-shrink-0 group"
                >
                  <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-[#92A2A5] shadow-sm">
                    <img
                      src={photo.dataUrl}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => deletePhoto(photo.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center bg-[#E17F70]/100 text-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#9E3B47]"
                  >
                    <X className="h-3 w-3" />
                  </button>

                  {/* Photo source & number badge */}
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-white text-xs font-medium flex items-center gap-0.5">
                    {photo.filename.startsWith('upload_') ? (
                      <Upload className="h-2 w-2" />
                    ) : (
                      <Camera className="h-2 w-2" />
                    )}
                    {index + 1}
                  </div>
                </div>
              ))}

              {/* Add more buttons */}
              {capturedPhotos.length < maxPhotos && !isCapturing && (
                <div className="flex gap-2">
                  <button
                    onClick={startCamera}
                    className="w-20 h-20 flex-shrink-0 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#92A2A5] text-[#979796] hover:border-[#6F8A9D] hover:text-[#6F8A9D] hover:bg-[#6F8A9D]/10 transition-colors"
                  >
                    <Camera className="h-4 w-4" />
                    <span className="text-[10px] mt-1">Camera</span>
                  </button>
                  <button
                    onClick={openFilePicker}
                    disabled={isProcessingUpload}
                    className="w-20 h-20 flex-shrink-0 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#92A2A5] text-[#979796] hover:border-[#6F8A9D] hover:text-[#6F8A9D] hover:bg-[#6F8A9D]/10 transition-colors disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="text-[10px] mt-1">Upload</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status Messages */}
        {required && capturedPhotos.length === 0 && !isCapturing && (
          <div className="flex items-center gap-3 p-3 bg-[#CE9F6B]/10 border border-[#CE9F6B]/50 rounded-lg">
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#CE9F6B]/20">
              <AlertTriangle className="h-4 w-4 text-[#976E44]" />
            </div>
            <p className="text-sm text-[#976E44]">
              Photo verification is required — capture with camera or upload from gallery
            </p>
          </div>
        )}

        {capturedPhotos.length >= maxPhotos && (
          <div className="flex items-center gap-3 p-3 bg-[#A2B9AF]/10 border border-[#A2B9AF] rounded-lg">
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#A2B9AF]/20">
              <Check className="h-4 w-4 text-[#4F6A64]" />
            </div>
            <p className="text-sm text-[#4F6A64]">
              All photos captured! Ready to proceed.
            </p>
          </div>
        )}
      </div>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default PhotoCapture;
