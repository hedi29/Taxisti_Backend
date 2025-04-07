// services/user-service/index.js
const express = require('express');
const { logger, AppError } = require('@yourride/common');
const { User, Driver } = require('@yourride/models');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase client for auth
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware
app.use(express.json());

// API routes
const router = express.Router();

// Authentication endpoints
router.post('/auth/validate-token', async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return next(new AppError(400, 'Token is required'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return next(new AppError(404, 'User not found'));
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError(401, 'Invalid token'));
    }
    if (err.name === 'TokenExpiredError') {
      return next(new AppError(401, 'Token expired'));
    }
    next(err);
  }
});

router.post('/auth/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return next(new AppError(400, 'Refresh token is required'));
    }
    
    // Verify refresh token
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });
    
    if (error) {
      return next(new AppError(401, error.message));
    }
    
    // Generate new JWT
    const user = await User.findById(data.user.id);
    
    const token = jwt.sign(
      { id: user.id, user_type: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    res.status(200).json({
      status: 'success',
      data: {
        token,
        user
      }
    });
  } catch (err) {
    next(err);
  }
});

// Profile Management
router.get('/users/profile', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return next(new AppError(404, 'User not found'));
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    next(err);
  }
});

router.put('/users/profile', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { first_name, last_name, phone } = req.body;
    
    const updatedUser = await User.update(userId, {
      first_name,
      last_name,
      phone,
      updated_at: new Date()
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser[0]
      }
    });
  } catch (err) {
    next(err);
  }
});

// Driver Management
router.get('/users/driver/profile', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    if (req.user.user_type !== 'driver') {
      return next(new AppError(403, 'Access denied. Only drivers can access this resource.'));
    }
    
    const driver = await Driver.findById(userId);
    
    if (!driver) {
      return next(new AppError(404, 'Driver profile not found'));
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        driver
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/users/driver/profile', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    if (req.user.user_type !== 'driver') {
      return next(new AppError(403, 'Access denied. Only drivers can access this resource.'));
    }
    
    const {
      vehicle_type,
      vehicle_make,
      vehicle_model,
      vehicle_year,
      license_plate,
      vehicle_color,
      driver_license_number,
      driver_license_expiry,
      insurance_policy_number
    } = req.body;
    
    // Check if driver profile already exists
    const existingDriver = await Driver.findById(userId);
    
    let driver;
    if (existingDriver) {
      // Update
      driver = await Driver.update(userId, {
        vehicle_type,
        vehicle_make,
        vehicle_model,
        vehicle_year,
        license_plate,
        vehicle_color,
        driver_license_number,
        driver_license_expiry,
        insurance_policy_number,
        updated_at: new Date()
      });
    } else {
      // Create
      driver = await Driver.create({
        driver_id: userId,
        vehicle_type,
        vehicle_make,
        vehicle_model,
        vehicle_year,
        license_plate,
        vehicle_color,
        driver_license_number,
        driver_license_expiry,
        insurance_policy_number
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        driver: driver[0]
      }
    });
  } catch (err) {
    next(err);
  }
});

// Add more endpoints as needed...
// Mount API routes
app.use('/api', router);

// 404 handler
app.all('*', (req, res, next) => {
  next(new AppError(404, `Cannot find ${req.originalUrl} on this service!`));
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
  logger.info(`User Service listening on port ${PORT}`);
});