import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';

// Store current PIN (in production, use database or environment variable)
// Default PIN: 123456 (change this immediately after setup)
let currentAccessPin = {
  pin: bcrypt.hashSync('123456', 10), // Generate fresh hash for "123456"
  plainPin: '123456', // Store plain PIN for admin display (secure this in production)
  createdAt: new Date()
};

// PIN attempt tracking for security
class AttemptTracker {
  private attempts = new Map<string, { count: number; lastAttempt: Date; lockedUntil?: Date }>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private readonly RESET_WINDOW = 60 * 60 * 1000; // 1 hour

  recordAttempt(ip: string, success: boolean): { allowed: boolean; attemptsLeft: number; lockedUntil?: Date } {
    const now = new Date();
    const record = this.attempts.get(ip) || { count: 0, lastAttempt: now };

    // Reset attempts if it's been more than an hour since last attempt
    if (now.getTime() - record.lastAttempt.getTime() > this.RESET_WINDOW) {
      record.count = 0;
      record.lockedUntil = undefined;
    }

    // Check if currently locked out
    if (record.lockedUntil && now < record.lockedUntil) {
      return {
        allowed: false,
        attemptsLeft: 0,
        lockedUntil: record.lockedUntil
      };
    }

    if (success) {
      // Reset on successful attempt
      this.attempts.delete(ip);
      return { allowed: true, attemptsLeft: this.MAX_ATTEMPTS };
    } else {
      // Increment failed attempts
      record.count++;
      record.lastAttempt = now;

      if (record.count >= this.MAX_ATTEMPTS) {
        record.lockedUntil = new Date(now.getTime() + this.LOCKOUT_DURATION);
        this.attempts.set(ip, record);
        return {
          allowed: false,
          attemptsLeft: 0,
          lockedUntil: record.lockedUntil
        };
      } else {
        this.attempts.set(ip, record);
        const attemptsLeft = this.MAX_ATTEMPTS - record.count;
        return {
          allowed: true,
          attemptsLeft
        };
      }
    }
  }

  getAttemptInfo(ip: string): { attemptsLeft: number; lockedUntil?: Date } {
    const record = this.attempts.get(ip);
    if (!record) {
      return { attemptsLeft: this.MAX_ATTEMPTS };
    }

    const now = new Date();

    // Reset if it's been more than an hour
    if (now.getTime() - record.lastAttempt.getTime() > this.RESET_WINDOW) {
      this.attempts.delete(ip);
      return { attemptsLeft: this.MAX_ATTEMPTS };
    }

    // Check if currently locked
    if (record.lockedUntil && now < record.lockedUntil) {
      return { attemptsLeft: 0, lockedUntil: record.lockedUntil };
    }

    return { attemptsLeft: this.MAX_ATTEMPTS - record.count };
  }
}

// PIN session storage (with better persistence strategy)
class SessionManager {
  private sessions = new Map<string, { validUntil: Date; ip: string }>();
  private readonly STORAGE_KEY = 'PIN_SESSIONS';

  constructor() {
    this.loadSessions();
    // Auto-save sessions every 5 minutes
    setInterval(() => this.saveSessions(), 5 * 60 * 1000);
  }

  private loadSessions(): void {
    try {
      if (typeof process !== 'undefined' && process.env.PERSIST_SESSIONS === 'true') {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(process.cwd(), 'sessions.json');

        if (fs.existsSync(filePath)) {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (data && Array.isArray(data)) {
            data.forEach(([id, session]) => {
              this.sessions.set(id, {
                ...session,
                validUntil: new Date(session.validUntil)
              });
            });
          }
        }
      }
    } catch (error) {
    }
  }

  private saveSessions(): void {
    try {
      if (typeof process !== 'undefined' && process.env.PERSIST_SESSIONS === 'true') {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(process.cwd(), 'sessions.json');

        // Clean expired sessions before saving
        this.clearExpiredSessions();

        // Convert Map to array for JSON serialization
        const data = Array.from(this.sessions.entries());
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      }
    } catch (error) {
    }
  }

  public set(id: string, session: { validUntil: Date; ip: string }): void {
    this.sessions.set(id, session);
    // Save immediately on new session
    if (typeof process !== 'undefined' && process.env.PERSIST_SESSIONS === 'true') {
      this.saveSessions();
    }
  }

  public get(id: string): { validUntil: Date; ip: string } | undefined {
    return this.sessions.get(id);
  }

  public delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  public clearExpiredSessions(): void {
    const now = new Date();
    let expiredCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.validUntil) {
        this.sessions.delete(sessionId);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
    }
  }

  public entries(): IterableIterator<[string, { validUntil: Date; ip: string }]> {
    return this.sessions.entries();
  }
}

// Create singleton instances
const sessionManager = new SessionManager();
const attemptTracker = new AttemptTracker();

export const generateAccessPin = (pin: string): void => {
  const salt = bcrypt.genSaltSync(10);
  currentAccessPin = {
    pin: bcrypt.hashSync(pin, salt),
    plainPin: pin, // Store plain PIN for admin display
    createdAt: new Date()
  };
};

export const getCurrentPin = () => currentAccessPin;

export const validateAccessPin = async (inputPin: string): Promise<boolean> => {
  // Validate PIN (no expiry check)
  const isValid = bcrypt.compareSync(inputPin, currentAccessPin.pin);
  return isValid;
};

export const createPinSession = (sessionId: string, ip: string): void => {
  sessionManager.set(sessionId, {
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    ip
  });
};

export const validatePinSession = (sessionId: string, ip: string): boolean => {
  const session = sessionManager.get(sessionId);
  if (!session) return false;

  // Check if session expired
  if (new Date() > session.validUntil) {
    sessionManager.delete(sessionId);
    return false;
  }

  // IP validation can be made optional via config
  if (process.env.VALIDATE_IP_FOR_PIN === 'true') {
    return session.ip === ip;
  }

  // Skip IP validation by default
  return true;
};

export const getPinSessionData = (sessionId: string) => {
  return sessionManager.get(sessionId);
};

export const clearExpiredSessions = (): void => {
  sessionManager.clearExpiredSessions();
};

// Attempt tracking functions
export const recordPinAttempt = (ip: string, success: boolean) => {
  return attemptTracker.recordAttempt(ip, success);
};

export const getPinAttemptInfo = (ip: string) => {
  return attemptTracker.getAttemptInfo(ip);
};

// Middleware to check PIN access
export const pinAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip PIN check for auth endpoints and health check
  const excludedPaths = [
    '/api/auth/validate-pin',
    '/api/auth/pin-status',
    '/api/auth/generate-pin',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh-token',
    '/api/auth/reset-password',
    '/api/auth/request-otp',
    '/api/auth/login-with-otp',
    '/health'
  ];

  // Skip entire PIN check if disabled in environment
  if (process.env.PIN_AUTH_ENABLED === 'false') {
    return next();
  }

  if (excludedPaths.includes(req.path)) {
    return next();
  }

  // Check for session in cookie or Authorization header
  const pinSessionId = req.cookies?.pinSession ||
    (req.headers.authorization?.startsWith('PinSession ') &&
      req.headers.authorization.split(' ')[1]);
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

  // Check if valid PIN session exists
  if (pinSessionId && validatePinSession(pinSessionId, clientIp)) {
    // Only refresh cookie session if it's close to expiry (within 1 hour)
    // to prevent unnecessary cookie setting on every request
    const sessionData = getPinSessionData(pinSessionId);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    if (req.cookies?.pinSession && sessionData && (sessionData.validUntil.getTime() - now) < oneHour) {
      const cookieOptions = {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production' && !req.headers.host?.includes('172.28.91.10') && !req.headers.host?.includes('10.91.1.12') && !req.headers.host?.includes('10.91.1.48') && !req.headers.host?.includes('10.91.1.49') && !req.headers.host?.includes('10.91.1.21') && !req.headers.host?.includes('localhost'),
        sameSite: 'lax' as const,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
        ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {})
      };
      res.cookie('pinSession', pinSessionId, cookieOptions);
    }
    return next();
  }

  // No valid PIN session - require PIN verification
  return res.status(403).json({
    error: 'PIN verification required',
    code: 'PIN_REQUIRED'
  });
};

// Clean up expired sessions every hour
setInterval(clearExpiredSessions, 60 * 60 * 1000);
