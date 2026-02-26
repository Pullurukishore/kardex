import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  validateAccessPin,
  createPinSession,
  getCurrentPin,
  generateAccessPin,
  recordPinAttempt,
  getPinAttemptInfo
} from '../middleware/pinAuth';

export const validatePin = async (req: Request, res: Response) => {
  try {
    const { pin } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    if (!pin) {
      return res.status(400).json({ error: 'PIN is required' });
    }

    // Validate PIN format (6 digits)
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be 6 digits' });
    }

    // Check if IP is currently locked out
    const attemptInfo = getPinAttemptInfo(clientIp);
    if (attemptInfo.lockedUntil && new Date() < attemptInfo.lockedUntil) {
      const minutesLeft = Math.ceil((attemptInfo.lockedUntil.getTime() - Date.now()) / (1000 * 60));
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${minutesLeft} minutes.`,
        code: 'RATE_LIMITED',
        lockedUntil: attemptInfo.lockedUntil,
        attemptsLeft: 0
      });
    }

    // Check if PIN is valid
    const isValid = await validateAccessPin(pin);

    // Record the attempt
    const attemptResult = recordPinAttempt(clientIp, isValid);

    if (!isValid) {
      if (!attemptResult.allowed) {
        // Account is now locked
        const minutesLeft = Math.ceil((attemptResult.lockedUntil!.getTime() - Date.now()) / (1000 * 60));
        return res.status(429).json({
          error: `Too many failed attempts. Account locked for ${minutesLeft} minutes.`,
          code: 'ACCOUNT_LOCKED',
          lockedUntil: attemptResult.lockedUntil,
          attemptsLeft: 0
        });
      } else {
        // Still have attempts left
        return res.status(401).json({
          error: `Invalid PIN. ${attemptResult.attemptsLeft} attempts remaining.`,
          code: 'INVALID_PIN',
          attemptsLeft: attemptResult.attemptsLeft
        });
      }
    }

    // Create PIN session
    const sessionId = uuidv4();
    createPinSession(sessionId, clientIp);

    // Set secure cookie (httpOnly: false so frontend can read it for validation)
    const cookieOptions = {
      httpOnly: false, // Allow JavaScript access for frontend validation
      secure: process.env.NODE_ENV === 'production' && !req.headers.host?.includes('172.28.91.10') && !req.headers.host?.includes('10.91.1.12') && !req.headers.host?.includes('10.91.1.48') && !req.headers.host?.includes('localhost'),
      sameSite: 'lax' as const, // 'lax' for better compatibility
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/', // Ensure cookie is available for all paths
      // Use the domain from environment or let browser determine automatically
      ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {})
    };
    res.cookie('pinSession', sessionId, cookieOptions);

    // Also set session data in response for client-side storage fallback
    const responseData = {
      success: true,
      message: 'PIN verified successfully',
      sessionId,
      expiresAt: new Date(Date.now() + cookieOptions.maxAge).toISOString()
    };

    // Log successful access
    // Return response with session data
    return res.json(responseData);

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const checkPinStatus = (req: Request, res: Response) => {
  try {
    const currentPin = getCurrentPin();
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const attemptInfo = getPinAttemptInfo(clientIp);

    res.json({
      pinRequired: false, // No expiry, PIN never required due to time
      createdAt: currentPin.createdAt,
      daysRemaining: null, // No expiry
      currentPin: currentPin.plainPin, // Include plain PIN for admin display
      // Add attempt tracking info
      attemptsLeft: attemptInfo.attemptsLeft,
      lockedUntil: attemptInfo.lockedUntil || null,
      maxAttempts: 5 // Let frontend know the limit
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const generateNewPin = async (req: Request, res: Response) => {
  try {
    const { newPin } = req.body;

    if (!newPin) {
      return res.status(400).json({ error: 'New PIN is required' });
    }

    // Validate PIN format
    if (!/^\d{6}$/.test(newPin)) {
      return res.status(400).json({ error: 'PIN must be 6 digits' });
    }

    // Generate new PIN
    generateAccessPin(newPin);
    res.json({
      success: true,
      message: 'New PIN generated successfully',
      createdAt: getCurrentPin().createdAt
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
