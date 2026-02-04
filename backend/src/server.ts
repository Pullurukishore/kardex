// Load environment variables first, before any other imports
import 'dotenv/config';

// Disable console logs in production (must be imported early)
import './utils/console-wrapper';

import { createServer, Server as HttpServer, IncomingMessage } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { app } from './app';
import { prisma } from './config/db';
import { JWT_CONFIG } from './config/auth';
import { logger } from './utils/logger';
import { CustomWebSocket } from './types/custom';
import { cronService } from './services/cron.service';
import { LocalPhotoStorageService } from './services/local-photo-storage.service';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

// Create HTTP server
const server: HttpServer = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({
  server,
  path: '/api/notifications/ws'
});

// Handle WebSocket connections
wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
  // Safe type conversion
  const customWs = ws as unknown as CustomWebSocket;

  // Initialize custom properties
  customWs.isAlive = true;

  // Extract token from query params
  const token = new URLSearchParams(req.url?.split('?')[1] || '').get('token');

  if (!token) {
    logger.warn('WebSocket connection attempt without token');
    ws.close(4008, 'Authentication token is required');
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_CONFIG.secret) as any;
    customWs.userId = decoded.id.toString();

    // Check if user is still active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id, isActive: true },
      select: { id: true, role: true }
    });

    if (!user) {
      logger.warn(`WebSocket connection: User ${decoded.id} not found or inactive`);
      ws.close(4003, 'User not found or inactive');
      return;
    }

    logger.info(`New WebSocket connection: ${customWs.userId} (${user.role})`);
  } catch (error) {
    logger.error('WebSocket auth failed:', error);
    ws.close(4001, 'Invalid authentication token');
    return;
  }

  // Handle pong messages
  customWs.on('pong', () => {
    customWs.isAlive = true;
  });

  // Handle messages
  customWs.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);
      switch (data.type) {
        case 'PING':
          customWs.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          break;
        default:
          logger.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      logger.error('Error processing WebSocket message:', error);
    }
  });

  // Handle close
  customWs.on('close', () => {
    if (customWs.userId) {
      // Cleanup logic can go here if needed
    }
    logger.info(`WebSocket connection closed: ${customWs.userId || 'unknown'}`);
  });
});

// Ping interval
const interval = setInterval(() => {
  wss.clients.forEach((client) => {
    const customClient = client as unknown as CustomWebSocket;

    if (!customClient.isAlive) {
      customClient.terminate();
      return;
    }

    customClient.isAlive = false;
    customClient.ping();
  });
}, 30000);

// Cleanup on server close
wss.on('close', () => {
  clearInterval(interval);
});

// Shutdown handler
const shutdown = () => {
  logger.info('Shutting down server...');

  wss.clients.forEach(client => {
    client.close(1001, 'Server shutting down');
  });

  server.close(() => {

    prisma.$disconnect()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error closing database:', errorMessage);
        process.exit(1);
      });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle unhandled promise rejections and uncaught exceptions to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optional: Shutdown gracefully if it's a critical error
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // For safety, shutdown gracefully on uncaught exceptions
  shutdown();
});

// Start server
const startServer = async () => {
  try {
    await prisma.$connect();

    // Initialize local storage
    logger.info('Initializing local storage...');
    try {
      await LocalPhotoStorageService.initialize();
      logger.info('✅ Local storage initialized successfully');
    } catch (error) {
      logger.error('❌ Local storage initialization failed - photo uploads will not work:', error);
    }

    // Start cron jobs
    cronService.startAutoCheckoutJob();
    logger.info('Cron jobs initialized');

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Access the server at http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    logger.error('Server startup failed:', error);
    process.exit(1);
  }
};

startServer();