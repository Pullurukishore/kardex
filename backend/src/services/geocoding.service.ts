import axios from 'axios';
import { logger } from '../utils/logger';
import { LocationValidationService } from './location-validation.service';

export type ReverseGeocodeResult = {
  address: string | null;
  source?: 'locationiq' | 'fallback';
  error?: string;
  coordinateValidation?: {
    isValid: boolean;
    distanceFromExpected?: number;
    warnings?: string[];
  };
};

export interface GeocodeOptions {
  boundingBox?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  expectedRegion?: {
    city?: string;
    state?: string;
    country?: string;
  };
  maxDistanceFromExpected?: number; // in kilometers
  expectedCoordinates?: {
    latitude: number;
    longitude: number;
  };
}

export class GeocodingService {
  private static readonly API_KEY = process.env.LOCATIONIQ_KEY || ''; // ✅ use .env
  private static readonly BASE_URL = 'https://us1.locationiq.com/v1/reverse.php';

  // Simple in-memory cache to avoid redundant API calls
  private static readonly CACHE = new Map<string, string>();
  private static readonly CACHE_LIMIT = 500;

  // Default bounding box for India (can be overridden per request)
  private static readonly DEFAULT_INDIA_BOUNDS = {
    minLat: 6.0,
    maxLat: 37.0,
    minLng: 68.0,
    maxLng: 97.0
  };

  // Major Indian cities for region validation
  private static readonly MAJOR_CITIES = {
    'mumbai': { lat: 19.0760, lng: 72.8777, radius: 50 },
    'delhi': { lat: 28.7041, lng: 77.1025, radius: 50 },
    'bangalore': { lat: 12.9716, lng: 77.5946, radius: 40 },
    'hyderabad': { lat: 17.3850, lng: 78.4867, radius: 40 },
    'chennai': { lat: 13.0827, lng: 80.2707, radius: 40 },
    'kolkata': { lat: 22.5726, lng: 88.3639, radius: 40 },
    'pune': { lat: 18.5204, lng: 73.8567, radius: 30 },
    'ahmedabad': { lat: 23.0225, lng: 72.5714, radius: 30 }
  };

  static async reverseGeocode(
    latitude: number,
    longitude: number,
    options: GeocodeOptions = {}
  ): Promise<ReverseGeocodeResult> {
    try {
      const latFixed = latitude.toFixed(5);
      const lngFixed = longitude.toFixed(5);
      const cacheKey = `${latFixed},${lngFixed}`;

      if (this.CACHE.has(cacheKey)) {
        return {
          address: this.CACHE.get(cacheKey)!,
          source: 'locationiq',
          coordinateValidation: { isValid: true }
        };
      }

      if (!this.API_KEY) {
        const errorMsg = 'Missing LocationIQ API key. Please set LOCATIONIQ_KEY in .env';
        logger.error(errorMsg);
        return {
          address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          source: 'fallback',
          error: errorMsg
        };
      }

      const boundingBox = options.boundingBox || this.DEFAULT_INDIA_BOUNDS;
      const params: any = {
        key: this.API_KEY,
        lat: latitude,
        lon: longitude,
        format: 'json',
        'accept-language': 'en',
        addressdetails: 1,
        zoom: 18,
        viewbox: `${boundingBox.minLng},${boundingBox.maxLat},${boundingBox.maxLng},${boundingBox.minLat}`,
        bounded: 1
      };

      if (options.expectedRegion?.country) {
        params.countrycodes = options.expectedRegion.country.toLowerCase();
      }

      const headers = {
        'Accept': 'application/json',
        'User-Agent': 'KardexCare/1.0 (support@kardexcare.local)',
      };

      const { data } = await axios.get(this.BASE_URL, {
        params,
        headers,
        timeout: 3000,
      });

      const address = this.formatAddress(data);

      const coordinateValidation = this.validateAddressCoordinates(
        latitude,
        longitude,
        data,
        options
      );

      if (address && address !== `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`) {
        // Cache successful result
        if (this.CACHE.size < this.CACHE_LIMIT) {
          this.CACHE.set(cacheKey, address);
        }

        return {
          address,
          source: 'locationiq',
          coordinateValidation
        };
      } else {
        logger.warn('LocationIQ returned no valid address, using coordinates');
        return {
          address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          source: 'fallback',
          error: 'No valid address found in LocationIQ response',
          coordinateValidation
        };
      }
    } catch (error: any) {
      logger.error('Reverse geocoding error:', {
        message: error.message,
        coordinates: `${latitude}, ${longitude}`
      });

      let errorMessage = 'Unknown geocoding error';
      if (error.code === 'ENOTFOUND') errorMessage = 'Network error: Unable to reach LocationIQ service';
      else if (error.response?.status === 401) errorMessage = 'Invalid LocationIQ API key';
      else if (error.response?.status === 429) errorMessage = 'LocationIQ API rate limit exceeded';
      else if (error.response?.status >= 500) errorMessage = 'LocationIQ service temporarily unavailable';
      else if (error.code === 'ECONNABORTED') errorMessage = 'Request timeout - LocationIQ service too slow';

      return {
        address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        source: 'fallback',
        error: errorMessage,
        coordinateValidation: {
          isValid: false,
          warnings: ['Geocoding service unavailable - using coordinates only']
        }
      };
    }
  }

  private static formatAddress(data: any): string | null {
    if (!data) return null;
    if (data.display_name && typeof data.display_name === 'string') return data.display_name;

    const { address } = data;
    if (address && typeof address === 'object') {
      const components = [
        address.house_number,
        address.road,
        address.neighbourhood,
        address.suburb,
        address.village || address.town || address.city,
        address.state,
        address.postcode,
        address.country,
      ].filter(component => component && typeof component === 'string');

      if (components.length > 0) return components.join(', ');
    }
    return null;
  }

  private static validateAddressCoordinates(
    inputLat: number,
    inputLng: number,
    geocodeData: any,
    options: GeocodeOptions
  ): { isValid: boolean; distanceFromExpected?: number; warnings?: string[] } {
    const warnings: string[] = [];
    if (!geocodeData.lat || !geocodeData.lon) {
      warnings.push('Geocoding service did not return coordinates');
      return { isValid: false, warnings };
    }

    const returnedLat = parseFloat(geocodeData.lat);
    const returnedLng = parseFloat(geocodeData.lon);
    const distance = LocationValidationService.calculateDistance(inputLat, inputLng, returnedLat, returnedLng);
    const maxAllowedDistance = options.maxDistanceFromExpected || 5;

    if (distance > maxAllowedDistance) {
      warnings.push(`Address coordinates are ${distance.toFixed(2)}km away from GPS location`);
      return { isValid: false, distanceFromExpected: distance, warnings };
    }

    if (options.expectedRegion) {
      const regionValidation = this.validateRegion(returnedLat, returnedLng, options.expectedRegion);
      if (!regionValidation.isValid) warnings.push(...regionValidation.warnings);
    }

    return { isValid: distance <= maxAllowedDistance, distanceFromExpected: distance, warnings: warnings.length > 0 ? warnings : undefined };
  }

  private static validateRegion(lat: number, lng: number, expectedRegion: { city?: string; state?: string; country?: string }): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    if (expectedRegion.city) {
      const cityKey = expectedRegion.city.toLowerCase();
      const cityInfo = this.MAJOR_CITIES[cityKey as keyof typeof this.MAJOR_CITIES];
      if (cityInfo) {
        const dist = LocationValidationService.calculateDistance(lat, lng, cityInfo.lat, cityInfo.lng);
        if (dist > cityInfo.radius) {
          warnings.push(`Location is ${dist.toFixed(1)}km from ${expectedRegion.city} center`);
          return { isValid: false, warnings };
        }
      }
    }
    return { isValid: true, warnings };
  }

  static async reverseGeocodeWithValidation(latitude: number, longitude: number, expectedCity?: string, maxDistanceKm: number = 5): Promise<ReverseGeocodeResult> {
    const options: GeocodeOptions = { maxDistanceFromExpected: maxDistanceKm, expectedCoordinates: { latitude, longitude } };
    if (expectedCity) {
      const cityKey = expectedCity.toLowerCase();
      const cityInfo = this.MAJOR_CITIES[cityKey as keyof typeof this.MAJOR_CITIES];
      if (cityInfo) {
        const buffer = 0.5;
        options.boundingBox = { minLat: cityInfo.lat - buffer, maxLat: cityInfo.lat + buffer, minLng: cityInfo.lng - buffer, maxLng: cityInfo.lng + buffer };
        options.expectedRegion = { city: expectedCity, country: 'in' };
      }
    }
    return this.reverseGeocode(latitude, longitude, options);
  }

  static async forwardGeocode(address: string): Promise<{ success: boolean; latitude?: number; longitude?: number; displayName?: string; error?: string; }> {
    try {
      if (!this.API_KEY) return { success: false, error: 'Missing LocationIQ API key' };
      if (!address || address.trim().length < 3) return { success: false, error: 'Address too short' };

      const params = {
        key: this.API_KEY,
        q: address.trim(),
        format: 'json',
        'accept-language': 'en',
        addressdetails: 1,
        limit: 1,
        countrycodes: 'in',
        viewbox: `${this.DEFAULT_INDIA_BOUNDS.minLng},${this.DEFAULT_INDIA_BOUNDS.maxLat},${this.DEFAULT_INDIA_BOUNDS.maxLng},${this.DEFAULT_INDIA_BOUNDS.minLat}`,
        bounded: 1
      };

      const SEARCH_URL = 'https://us1.locationiq.com/v1/search.php';
      const { data } = await axios.get(SEARCH_URL, { params, timeout: 10000 });

      if (data && Array.isArray(data) && data.length > 0) {
        return { success: true, latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon), displayName: data[0].display_name };
      }
      return { success: false, error: 'No results found' };
    } catch (error: any) {
      return { success: false, error: 'Geocoding failed' };
    }
  }
}
