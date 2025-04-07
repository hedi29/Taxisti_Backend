// services/location-service/index.js
const express = require('express');
const { logger, AppError } = require('@yourride/common');
const { createClient } = require('redis');
const { Client: GoogleMapsClient } = require('@googlemaps/google-maps-services-js');
const { Driver, DriverLocation } = require('@yourride/models');

const app = express();
const PORT = process.env.PORT || 3004;

// Redis client for real-time data
const redisClient = createClient({
  url: process.env.REDIS_URL
});

// Google Maps client
const googleMapsClient = new GoogleMapsClient({});

(async () => {
  await redisClient.connect();
})();

// Middleware
app.use(express.json());

// API routes
const router = express.Router();

// Update user location
router.put('/location', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, heading, speed, accuracy } = req.body;
    
    if (!latitude || !longitude) {
      return next(new AppError(400, 'Latitude and longitude are required'));
    }
    
    // Store location in Redis (for real-time use)
    await redisClient.geoAdd('user_locations', {
      longitude,
      latitude,
      member: userId
    });
    
    // Set expiration for location data (30 minutes)
    await redisClient.expire(`user_locations:${userId}`, 30 * 60);
    
    // For drivers, also update the driver profile
    if (req.user.user_type === 'driver') {
      // Update driver's current location in database
      await Driver.updateLocation(userId, { 
        current_location: `POINT(${longitude} ${latitude})`,
        last_location_update: new Date()
      });
      
      // Store in location history for analytics
      await DriverLocation.create({
        driver_id: userId,
        location: `POINT(${longitude} ${latitude})`,
        heading,
        speed,
        accuracy
      });
      
      // If driver is online, publish location update for real-time matching
      const driver = await Driver.findById(userId);
      if (driver && driver.is_online) {
        await redisClient.publish('driver:location', JSON.stringify({
          driver_id: userId,
          location: { latitude, longitude },
          heading,
          last_update: new Date()
        }));
      }
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        message: 'Location updated successfully'
      }
    });
  } catch (err) {
    next(err);
  }
});

// Geocoding
router.post('/location/geocode', async (req, res, next) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return next(new AppError(400, 'Address is required'));
    }
    
    const response = await googleMapsClient.geocode({
      params: {
        address,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });
    
    if (response.data.status !== 'OK' || !response.data.results.length) {
      return next(new AppError(400, 'Could not geocode address'));
    }
    
    const result = response.data.results[0];
    
    res.status(200).json({
      status: 'success',
      data: {
        formatted_address: result.formatted_address,
        location: result.geometry.location,
        place_id: result.place_id
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/location/reverse-geocode', async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    
    if (!latitude || !longitude) {
      return next(new AppError(400, 'Latitude and longitude are required'));
    }
    
    const response = await googleMapsClient.reverseGeocode({
      params: {
        latlng: `${latitude},${longitude}`,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });
    
    if (response.data.status !== 'OK' || !response.data.results.length) {
      return next(new AppError(400, 'Could not reverse geocode coordinates'));
    }
    
    const result = response.data.results[0];
    
    res.status(200).json({
      status: 'success',
      data: {
        formatted_address: result.formatted_address,
        place_id: result.place_id,
        address_components: result.address_components
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get nearby drivers
router.get('/location/drivers', async (req, res, next) => {
  try {
    if (req.user.user_type !== 'rider') {
      return next(new AppError(403, 'Unauthorized'));
    }
    
    const { latitude, longitude, radius = 3 } = req.query;
    
    if (!latitude || !longitude) {
      return next(new AppError(400, 'Latitude and longitude are required'));
    }
    
    // Get nearby driver IDs from Redis
    const nearbyDrivers = await redisClient.geoRadius('user_locations', {
      longitude: parseFloat(longitude),
      latitude: parseFloat(latitude),
      radius: parseFloat(radius),
      unit: 'km'
    });
    
    // Get driver details from database
    const drivers = await Promise.all(
      nearbyDrivers.map(async (driverId) => {
        // Verify the driver is online and available
        const driver = await Driver.findById(driverId);
        if (driver && driver.is_online) {
          return driver;
        }
        return null;
      })
    );
    
    // Filter out null values and sensitive information
    const filteredDrivers = drivers
      .filter(driver => driver !== null)
      .map(driver => ({
        id: driver.driver_id,
        vehicle_type: driver.vehicle_type,
        vehicle_color: driver.vehicle_color,
        average_rating: driver.average_rating
      }));
    
    res.status(200).json({
      status: 'success',
      results: filteredDrivers.length,
      data: {
        drivers: filteredDrivers
      }
    });
  } catch (err) {
    next(err);
  }
});

// More location service endpoints...

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
  logger.info(`Location Service listening on port ${PORT}`);
});