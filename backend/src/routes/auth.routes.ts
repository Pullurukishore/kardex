import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { body, validationResult, ValidationChain } from 'express-validator';
import { UserRole } from '@prisma/client';
import {
  register,
  login,
  logout,
  getCurrentUser,
  refreshToken,
  resetPassword
} from '../controllers/auth.controller';
import {
  validatePin,
  checkPinStatus,
  generateNewPin
} from '../controllers/pinAuthController';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';

// Type guard for UserRole
const isUserRole = (value: unknown): value is UserRole => {
  return typeof value === 'string' &&
    (value === 'ADMIN' ||
      value === 'ZONE_MANAGER' ||
      value === 'ZONE_USER' ||
      value === 'SERVICE_PERSON' ||
      value === 'EXTERNAL_USER' ||
      value === 'EXPERT_HELPDESK');
};

// Role validation middleware
const validateRole = (value: unknown) => {
  if (!isUserRole(value)) {
    throw new Error('Invalid role');
  }
  return true;
};

// Helper function to validate request
const validateRequest = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map((validation: any) => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    return res.status(400).json({ errors: errors.array() });
  };
};
const router = Router();

// Rate limiting for login endpoint to prevent brute force attacks - Industry standard
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per window (industry standard)
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: true, // Don't count successful logins against the limit
});

// Register route - ADMIN only
router.post(
  '/register',
  authenticate,
  requireRole('ADMIN'),
  validateRequest([
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('role').custom(validateRole),
    body('customerId').optional().isInt(),
    body('phone').optional().isMobilePhone('any'),
    body('name').optional().isString().trim()
  ]),
  (register as unknown) as RequestHandler
);

// Login route with rate limiting
router.post(
  '/login',
  loginLimiter,
  validateRequest([
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ]),
  (login as unknown) as RequestHandler
);

// Request OTP route (placeholder for future implementation)
router.post(
  '/request-otp',
  validateRequest([
    body('email').isEmail().normalizeEmail()
  ]),
  (req: Request, res: Response) => {
    return res.status(501).json({ message: 'OTP functionality not yet implemented' });
  }
);

// Login with OTP route (placeholder for future implementation)
router.post(
  '/login-with-otp',
  validateRequest([
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 })
  ]),
  (req: Request, res: Response) => {
    return res.status(501).json({ message: 'OTP login not yet implemented' });
  }
);

// Protected routes - require authentication
router.get('/me', authenticate, (req, res, next) => {
  const authReq = req as unknown as AuthenticatedRequest;
  return getCurrentUser(authReq, res).catch(next);
});

router.post('/logout', authenticate, (req, res, next) => {
  const authReq = req as unknown as AuthenticatedRequest;
  return logout(authReq, res).catch(next);
});

// Rate limiting for refresh token endpoint to prevent abuse
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 refresh requests per window
  message: {
    success: false,
    message: 'Too many refresh attempts, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Refresh token route (no authentication required) with rate limiting
router.post('/refresh-token', refreshLimiter, (req, res, next) => {
  return refreshToken(req, res).catch(next);
});

// Rate limiting for password reset to prevent abuse
const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 reset attempts per hour
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again after an hour.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Reset password route (admin sends the reset link to users)
router.post(
  '/reset-password',
  resetPasswordLimiter,
  validateRequest([
    body('token').notEmpty().isString(),
    body('password').isLength({ min: 6 })
  ]),
  (req: Request, res: Response, next: NextFunction) => {
    return resetPassword(req, res).catch(next);
  }
);

// PIN Authentication routes
router.post('/validate-pin', (req: Request, res: Response, next: NextFunction) => {
  return validatePin(req, res).catch(next);
});

router.get('/pin-status', (req: Request, res: Response, next: NextFunction) => {
  // Removed debug log to reduce spam
  return checkPinStatus(req, res);
});

// Admin only - generate new PIN
router.post(
  '/generate-pin',
  authenticate,
  validateRequest([
    body('newPin').isLength({ min: 6, max: 6 }).isNumeric()
  ]),
  (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as unknown as AuthenticatedRequest;
    // Check if user is admin
    if (authReq.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return generateNewPin(req, res).catch(next);
  }
);

export default router;
