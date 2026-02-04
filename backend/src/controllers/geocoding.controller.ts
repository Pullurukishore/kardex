import { Request, Response } from 'express';
import { GeocodingService } from '../services/geocoding.service';
import { LocationValidationService, LocationData } from '../services/location-validation.service';
import { logger } from '../utils/logger';

export const reverseGeocode = async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, accuracy, source, expectedCity, maxDistance } = req.query;

    // Validate input
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const lat = parseFloat(latitude as string);
    const lng = parseFloat(longitude as string);
    const acc = accuracy ? parseFloat(accuracy as string) : undefined;

    // Create location data for validation
    const locationData: LocationData = {
      latitude: lat,
      longitude: lng,
      accuracy: acc,
      timestamp: Date.now(),
      source: (source as any) || 'gps'
    };

    // Validate location using enhanced validation service
    const validation = LocationValidationService.validateLocation(locationData);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Location validation failed',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    // Call the enhanced geocoding service with validation
    const maxDistanceKm = maxDistance ? parseFloat(maxDistance as string) : 5;
    const result = await GeocodingService.reverseGeocodeWithValidation(
      lat,
      lng,
      expectedCity as string,
      maxDistanceKm
    );

    // Get location quality assessment
    const quality = LocationValidationService.getLocationQuality(locationData);

    res.json({
      success: true,
      data: {
        latitude: lat,
        longitude: lng,
        address: result.address,
        coordinates: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        source: result.source,
        error: result.error,
        validation: {
          isValid: validation.isValid,
          warnings: validation.warnings,
          quality: quality
        },
        coordinateValidation: result.coordinateValidation,
        accuracy: acc,
        timestamp: locationData.timestamp,
        // Include coordinate validation warnings in main response
        allWarnings: [
          ...(validation.warnings || []),
          ...(result.coordinateValidation?.warnings || [])
        ].filter(Boolean)
      }
    });

  } catch (error) {
    logger.error('Geocoding controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reverse geocode coordinates'
    });
  }
};

export const validateLocationJump = async (req: Request, res: Response) => {
  try {
    const { previousLocation, newLocation, maxSpeed } = req.body;

    // Validate input
    if (!previousLocation || !newLocation) {
      return res.status(400).json({
        success: false,
        message: 'Both previousLocation and newLocation are required'
      });
    }

    // Validate location data structure
    const requiredFields = ['latitude', 'longitude'];
    for (const field of requiredFields) {
      if (previousLocation[field] === undefined || newLocation[field] === undefined) {
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`
        });
      }
    }

    // Convert to LocationData format
    const prevLocationData: LocationData = {
      latitude: parseFloat(previousLocation.latitude),
      longitude: parseFloat(previousLocation.longitude),
      accuracy: previousLocation.accuracy ? parseFloat(previousLocation.accuracy) : undefined,
      timestamp: previousLocation.timestamp || Date.now() - 60000, // Default to 1 minute ago
      source: previousLocation.source || 'gps'
    };

    const newLocationData: LocationData = {
      latitude: parseFloat(newLocation.latitude),
      longitude: parseFloat(newLocation.longitude),
      accuracy: newLocation.accuracy ? parseFloat(newLocation.accuracy) : undefined,
      timestamp: newLocation.timestamp || Date.now(),
      source: newLocation.source || 'gps'
    };

    // Validate both locations
    const prevValidation = LocationValidationService.validateLocation(prevLocationData);
    const newValidation = LocationValidationService.validateLocation(newLocationData);

    if (!prevValidation.isValid || !newValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'One or both locations are invalid',
        previousLocationErrors: prevValidation.errors,
        newLocationErrors: newValidation.errors
      });
    }

    // Detect location jump
    const jumpResult = LocationValidationService.detectLocationJump(
      prevLocationData,
      newLocationData,
      maxSpeed ? parseFloat(maxSpeed) : undefined
    );

    res.json({
      success: true,
      data: {
        isUnrealisticJump: jumpResult.isUnrealistic,
        distance: jumpResult.distance,
        speed: jumpResult.speed,
        timeElapsed: jumpResult.timeElapsed,
        reason: jumpResult.reason,
        previousLocation: prevLocationData,
        newLocation: newLocationData,
        validation: {
          previousLocation: {
            isValid: prevValidation.isValid,
            warnings: prevValidation.warnings,
            quality: LocationValidationService.getLocationQuality(prevLocationData)
          },
          newLocation: {
            isValid: newValidation.isValid,
            warnings: newValidation.warnings,
            quality: LocationValidationService.getLocationQuality(newLocationData)
          }
        }
      }
    });

  } catch (error) {
    logger.error('Location jump validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate location jump'
    });
  }
};

/**
 * Forward geocode an address to coordinates
 * Used for manual address entry
 */
export const forwardGeocode = async (req: Request, res: Response) => {
  try {
    const { address } = req.query;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Address is required'
      });
    }

    if (address.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Address must be at least 3 characters'
      });
    }

    const result = await GeocodingService.forwardGeocode(address);

    if (result.success) {
      res.json({
        success: true,
        data: {
          latitude: result.latitude,
          longitude: result.longitude,
          displayName: result.displayName,
          address: address.trim()
        }
      });
    } else {
      // Return success: false but with 200 status so frontend can handle gracefully
      res.json({
        success: false,
        message: result.error || 'Could not geocode address',
        data: null
      });
    }

  } catch (error) {
    logger.error('Forward geocoding controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to geocode address'
    });
  }
};

