// services/api-gateway/index.js
const express = require('express');
const proxy = require('express-http-proxy');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { logger, AppError } = require('@yourride/common');
const { authenticate } = require('@yourride/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.'
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date() });
});

// Routing to microservices
// Auth endpoints - no auth required
app.post('/auth/validate-token', proxy(process.env.USER_SERVICE_URL));
app.post('/auth/refresh-token', proxy(process.env.USER_SERVICE_URL));

// User Service
app.use('/users', authenticate, proxy(process.env.USER_SERVICE_URL, {
  proxyReqPathResolver: (req) => `/api${req.url}`
}));

// Ride Service
app.use('/rides', authenticate, proxy(process.env.RIDE_SERVICE_URL, {
  proxyReqPathResolver: (req) => `/api${req.url}`
}));

// Payment Service
app.use('/payments', authenticate, proxy(process.env.PAYMENT_SERVICE_URL, {
  proxyReqPathResolver: (req) => `/api${req.url}`
}));

// Location Service
app.use('/location', authenticate, proxy(process.env.LOCATION_SERVICE_URL, {
  proxyReqPathResolver: (req) => `/api${req.url}`
}));

// Notification Service
app.use('/notifications', authenticate, proxy(process.env.NOTIFICATION_SERVICE_URL, {
  proxyReqPathResolver: (req) => `/api${req.url}`
}));

// Promo Service (part of payment service in this architecture)
app.use('/promos', authenticate, proxy(process.env.PAYMENT_SERVICE_URL, {
  proxyReqPathResolver: (req) => `/api/promos${req.url}`
}));

// Admin Service endpoints
app.use('/admin', authenticate, (req, res, next) => {
  if (req.user.user_type !== 'admin') {
    return next(new AppError(403, 'Admin access required'));
  }
  next();
}, (req, res, next) => {
  const service = req.url.split('/')[1];
  switch(service) {
    case 'users':
    case 'drivers':
      return proxy(process.env.USER_SERVICE_URL, {
        proxyReqPathResolver: (req) => `/api${req.url}`
      })(req, res, next);
    case 'rides':
      return proxy(process.env.RIDE_SERVICE_URL, {
        proxyReqPathResolver: (req) => `/api${req.url}`
      })(req, res, next);
    case 'analytics':
      // Analytics is distributed, so we need to determine which service to route to
      const analyticsType = req.url.split('/')[2];
      if (['users', 'drivers'].includes(analyticsType)) {
        return proxy(process.env.USER_SERVICE_URL, {
          proxyReqPathResolver: (req) => `/api${req.url}`
        })(req, res, next);
      } else if (['rides'].includes(analyticsType)) {
        return proxy(process.env.RIDE_SERVICE_URL, {
          proxyReqPathResolver: (req) => `/api${req.url}`
        })(req, res, next);
      } else if (['revenue'].includes(analyticsType)) {
        return proxy(process.env.PAYMENT_SERVICE_URL, {
          proxyReqPathResolver: (req) => `/api${req.url}`
        })(req, res, next);
      }
      break;
    case 'promos':
      return proxy(process.env.PAYMENT_SERVICE_URL, {
        proxyReqPathResolver: (req) => `/api${req.url}`
      })(req, res, next);
    case 'surge':
      return proxy(process.env.RIDE_SERVICE_URL, {
        proxyReqPathResolver: (req) => `/api${req.url}`
      })(req, res, next);
    default:
      return next(new AppError(404, 'Resource not found'));
  }
});

// 404 handler
app.all('*', (req, res, next) => {
  next(new AppError(404, `Cannot find ${req.originalUrl} on this server!`));
});

// Global error handler
app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  logger.error({
    message: err.message,
    stack: err.stack,
    status: err.status,
    statusCode: err.statusCode,
    url: req.originalUrl
  });
  
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`API Gateway listening on port ${PORT}`);
});