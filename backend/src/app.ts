import express from 'express';
import path from 'path';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { WebSocket as BaseWebSocket, WebSocketServer } from 'ws';
import { Request, Response, NextFunction } from 'express-serve-static-core';
import customerRoutes from './routes/customer.routes';
import contactAdminRoutes from './routes/contact-admin.routes';
import assetRoutes from './routes/asset.routes';
import serviceZoneRoutes from './routes/serviceZone.routes';
import dashboardRoutes from './routes/dashboard.routes';
import ticketRoutes from './routes/ticket.routes';
import servicePersonRoutes from './routes/servicePerson.routes';
import zoneUserRoutes from './routes/zoneUser.routes';
import zoneRoutes from './routes/zone.routes';
import zoneDashboardRoutes from './routes/zone-dashboard.routes';
import zoneReportRoutes from './routes/zone-report.routes';
import authRoutes from './routes/auth.routes';
import reportsRoutes from './routes/reports.routes';
import fsaRoutes from './routes/fsaRoutes';
import adminRoutes from './routes/admin.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import ratingRoutes from './routes/rating.routes';
import onsiteVisitRoutes from './routes/onsite-visit.routes';
import attendanceRoutes from './routes/attendanceRoutes';
import activityRoutes from './routes/activityRoutes';
import adminAttendanceRoutes from './routes/admin-attendance.routes';
import zoneAttendanceRoutes from './routes/zone-attendance.routes';
import servicePersonReportsRoutes from './routes/service-person-reports.routes';
import servicePersonAttendanceRoutes from './routes/service-person-attendance.routes';
import notificationRoutes from './routes/notification.routes';
import geocodingRoutes from './routes/geocoding.routes';
import photoRoutes from './routes/photo.routes';
import activityScheduleRoutes from './routes/activityScheduleRoutes';
import { storageConfig, initializeStorage } from './config/storage.config';
import { pinAuthMiddleware } from './middleware/pinAuth';

import offerRoutes from './routes/offer.routes';
import targetRoutes from './routes/target.routes';
import sparePartRoutes from './routes/sparePart.routes';
import imageManagementRoutes from './routes/image-management.routes';
import forecastRoutes from './routes/forecast.routes';

const app = express();
const server = http.createServer(app);

// WebSocket server is now managed in server.ts to avoid redundancy

// CORS Configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, origin?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if CORS_ORIGIN is set to allow all origins
    if (process.env.CORS_ORIGIN === '*') {
      return callback(null, true);
    }

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://34.14.156.49:3000',
      'http://172.28.91.10:3000',
      'http://10.91.1.12:3000',
      'http://10.91.1.48:3000',
      'http://10.91.1.49:3000',
      'http://10.91.1.21:3000',
      process.env.CORS_ORIGIN,
      // Add other allowed origins as needed
    ].filter(Boolean);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Required for cookies, authorization headers with HTTPS
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Access-Token',
    'X-Refresh-Token',
    'X-Skip-Global-Error-Handler',
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range',
    'X-Access-Token',
    'X-Refresh-Token',
  ],
  maxAge: 86400, // 24 hours
};

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disabled for development to avoid blocking local assets
  frameguard: false, // Allow iframes for file previews
}));

// Enable CORS with options
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// --- BODY PARSER SECURITY ---
// Global limit for standard JSON (Industry standard 100kb-1mb)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// High limit ONLY for routes that handle base64 photo uploads
const uploadLimit = express.json({ limit: '50mb' });
app.use('/api/tickets/:id/photos', uploadLimit);
app.use('/api/activities/:id/photos', uploadLimit);
app.use('/api/photos', uploadLimit); // If generic upload exists
// --- END BODY PARSER SECURITY ---

// Parse cookies
app.use(cookieParser());

// Ensure storage directories exist and serve storage files with CORS headers
initializeStorage();

// Global rate limiting - Industry standard
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000, // Limit each IP to 3000 requests per window (increased for office environments)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);
// Use storageConfig.root to keep serving path consistent with where files are saved
const storagePath = storageConfig.root;
app.use('/storage', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');

  // Set cache headers for better performance
  if (req.method === 'GET') {
    res.header('Cache-Control', 'public, max-age=31536000');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
}, express.static(storagePath, {
  setHeaders: (res, path) => {
    if (path.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
  },
  maxAge: '1y',
  immutable: true
}));

// Also serve from parent project root storage as a fallback (in case files were saved there)
const parentStoragePath = path.resolve(process.cwd(), '..', 'storage');
if (parentStoragePath !== storagePath) {
  app.use('/storage', express.static(parentStoragePath));
}

// API Routes
app.use('/api/auth', authRoutes);

// Apply PIN authentication middleware only to login route
app.use('/api/auth/login', pinAuthMiddleware);

app.use('/api/customers', customerRoutes);
app.use('/api/contacts', contactAdminRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/service-zones', serviceZoneRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/service-persons', servicePersonRoutes);
app.use('/api/zone-users', zoneUserRoutes);
app.use('/api/zone', zoneRoutes);
app.use('/api/zone-dashboard', zoneDashboardRoutes);
app.use('/api/zone-reports', zoneReportRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/fsa', fsaRoutes);
// Register specific admin routes BEFORE generic /api/admin routes to avoid route conflicts
app.use('/api/admin/attendance', adminAttendanceRoutes);
app.use('/api/zone/attendance', zoneAttendanceRoutes);
app.use('/api/admin', adminRoutes);
// Also expose /api/users endpoint directly for convenience
app.use('/api/users', adminRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/onsite-visits', onsiteVisitRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/admin/service-person-reports', servicePersonReportsRoutes);
app.use('/api/service-person-reports', servicePersonReportsRoutes);
app.use('/api/service-person/attendance', servicePersonAttendanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api', photoRoutes);
app.use('/api/activity-schedule', activityScheduleRoutes);

// Offer Funnel Routes
app.use('/api/offers', offerRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/spare-parts', sparePartRoutes);
app.use('/api/image-management', imageManagementRoutes);
app.use('/api/forecast', forecastRoutes);

// AR (Accounts Receivable) Routes - Finance Module
import arRoutes from './routes/ar';
app.use('/api/ar', arRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

// Export both the Express app and HTTP server
export { app, server };
