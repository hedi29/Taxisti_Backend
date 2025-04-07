// services/ride-service/index.js
const express = require('express');
const { logger, AppError } = require('@yourride/common');
const { createClient } = require('redis');
const { User, Ride, RideHistory } = require('@yourride/models');

const app = express();
const PORT = process.env.PORT || 3002;

// Redis client for real-time data
const redisClient = createClient({
  url: process.env.REDIS_URL
});

(async () => {
  await redisClient.connect();
})();

// Middleware
app.use(express.json());

// API routes
const router = express.Router();

// Ride Management
router.post('/rides', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    if (req.user.user_type !== 'rider') {
      return next(new AppError(403, 'Only riders can create ride requests'));
    }
    
    const {
      pickup_location,
      dropoff_location,
      pickup_address,
      dropoff_address,
      scheduled_time
    } = req.body;
    
    // Validate required fields
    if (!pickup_location || !dropoff_location || !pickup_address || !dropoff_address) {
      return next(new AppError(400, 'Missing required fields'));
    }
    
    // Create ride
    const ride = await Ride.create({
      rider_id: userId,
      pickup_location: `POINT(${pickup_location.longitude} ${pickup_location.latitude})`,
      dropoff_location: `POINT(${dropoff_location.longitude} ${dropoff_location.latitude})`,
      pickup_address,
      dropoff_address,
      status: 'requested',
      scheduled_time: scheduled_time || null
    });
    
    // Record in ride history
    await RideHistory.create({
      ride_id: ride[0].id,
      status: 'requested',
      location: `POINT(${pickup_location.longitude} ${pickup_location.latitude})`,
      notes: 'Ride requested by user'
    });
    
    // Publish to Redis for real-time driver matching
    if (!scheduled_time) {
      await redisClient.publish('ride:new', JSON.stringify({
        ride_id: ride[0].id,
        pickup_location,
        rider_id: userId
      }));
    }
    
    res.status(201).json({
      status: 'success',
      data: {
        ride: ride[0]
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/rides', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get user rides based on user type
    let rides;
    if (req.user.user_type === 'rider') {
      rides = await Ride.findByRider(userId);
    } else if (req.user.user_type === 'driver') {
      rides = await Ride.findByDriver(userId);
    } else {
      return next(new AppError(403, 'Unauthorized'));
    }
    
    res.status(200).json({
      status: 'success',
      results: rides.length,
      data: {
        rides
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/rides/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const ride = await Ride.findById(id);
    
    if (!ride) {
      return next(new AppError(404, 'Ride not found'));
    }
    
    // Check if user is authorized to view this ride
    if (req.user.user_type === 'rider' && ride.rider_id !== userId) {
      return next(new AppError(403, 'Unauthorized'));
    }
    
    if (req.user.user_type === 'driver' && ride.driver_id !== userId) {
      return next(new AppError(403, 'Unauthorized'));
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        ride
      }
    });
  } catch (err) {
    next(err);
  }
});

router.put('/rides/:id/cancel', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;
    
    const ride = await Ride.findById(id);
    
    if (!ride) {
      return next(new AppError(404, 'Ride not found'));
    }
    
    // Check if ride can be cancelled
    if (['completed', 'cancelled'].includes(ride.status)) {
      return next(new AppError(400, `Cannot cancel a ${ride.status} ride`));
    }
    
    // Check if user is authorized to cancel this ride
    if (req.user.user_type === 'rider' && ride.rider_id !== userId) {
      return next(new AppError(403, 'Unauthorized'));
    }
    
    if (req.user.user_type === 'driver' && ride.driver_id !== userId) {
      return next(new AppError(403, 'Unauthorized'));
    }
    
    // Update ride
    const updatedRide = await Ride.update(id, {
      status: 'cancelled',
      cancellation_reason: reason || 'Cancelled by user',
      cancelled_by: userId,
      updated_at: new Date()
    });
    
    // Record in ride history
    await RideHistory.create({
      ride_id: id,
      status: 'cancelled',
      notes: `Cancelled by ${req.user.user_type}: ${reason || 'No reason provided'}`
    });
    
    // Publish cancellation event
    await redisClient.publish('ride:cancelled', JSON.stringify({
      ride_id: id,
      cancelled_by: userId,
      user_type: req.user.user_type
    }));
    
    res.status(200).json({
      status: 'success',
      data: {
        ride: updatedRide[0]
      }
    });
  } catch (err) {
    next(err);
  }
});

// More ride service endpoints...

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

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  await redisClient.quit();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`Ride Service listening on port ${PORT}`);
});