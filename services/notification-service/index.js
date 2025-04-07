// services/notification-service/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { logger, AppError } = require('@yourride/common');
const { createClient } = require('redis');
const admin = require('firebase-admin');
const { Notification } = require('@yourride/models');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3005;

// Redis client for pub/sub
const redisClient = createClient({
  url: process.env.REDIS_URL
});

const redisSub = redisClient.duplicate();

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});

(async () => {
  await redisClient.connect();
  await redisSub.connect();
  
  // Subscribe to relevant channels
  await redisSub.subscribe('ride:new', handleRideNew);
  await redisSub.subscribe('ride:accepted', handleRideAccepted);
  await redisSub.subscribe('ride:cancelled', handleRideCancelled);
  await redisSub.subscribe('ride:completed', handleRideCompleted);
  await redisSub.subscribe('payment:completed', handlePaymentCompleted);
})();

// Socket.io setup
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  
  socket.on('authenticate', (token) => {
    // Verify token and associate socket with user
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = user.id;
      socket.join(user.id); // Join room with user ID
      logger.info(`User ${user.id} authenticated on socket ${socket.id}`);
    } catch (err) {
      logger.error(`Socket authentication error: ${err.message}`);
      socket.disconnect();
    }
  });
  
  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Redis message handlers
async function handleRideNew(message) {
  try {
    const data = JSON.parse(message);
    
    // Find nearby drivers and notify them
    // Implementation would depend on your driver matching algorithm
    logger.info(`New ride request: ${data.ride_id}`);
    
    // Example: notify nearby drivers via socket.io
    // In a real implementation, you'd query for nearby drivers
    // io.to('available_drivers').emit('new_ride', { ride_id: data.ride_id });
  } catch (err) {
    logger.error(`Error handling ride:new message: ${err.message}`);
  }
}

async function handleRideAccepted(message) {
  try {
    const data = JSON.parse(message);
    
    // Create notification for rider
    const notification = await Notification.create({
      user_id: data.rider_id,
      type: 'ride_accepted',
      title: 'Driver accepted your ride',
      body: 'Your driver is on the way!',
      data: JSON.stringify({
        ride_id: data.ride_id,
        driver_id: data.driver_id
      })
    });
    
    // Send push notification
    await sendPushNotification(data.rider_id, {
      title: 'Driver accepted your ride',
      body: 'Your driver is on the way!',
      data: {
        ride_id: data.ride_id,
        screen: 'RideDetail'
      }
    });
    
    // Send real-time notification via socket
    io.to(data.rider_id).emit('ride_accepted', {
      ride_id: data.ride_id,
      notification: notification[0]
    });
  } catch (err) {
    logger.error(`Error handling ride:accepted message: ${err.message}`);
  }
}

// Implement other handlers similarly...

// Helper function to send push notifications
async function sendPushNotification(userId, notification) {
  try {
    // Get user's device tokens
    const devices = await Device.findByUser(userId);
    
    if (!devices.length) {
      return;
    }
    
    const tokens = devices.map(device => device.token);
    
    // Send to Firebase Cloud Messaging
    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data,
      tokens
    };
    
    const response = await admin.messaging().sendMulticast(message);
    logger.info(`Sent notification to ${response.successCount} devices`);
    
    // Remove failed tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      
      // services/notification-service/index.js (continuation)
      // Remove failed tokens from database
      await Promise.all(
        failedTokens.map(async (token) => {
          return Device.removeByToken(token);
        })
      );
    }
  } catch (err) {
    logger.error(`Error sending push notification: ${err.message}`);
  }
}

// Middleware
app.use(express.json());

// API routes
const router = express.Router();

// Get user notifications
router.get('/notifications', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const notifications = await Notification.findByUser(userId);
    
    res.status(200).json({
      status: 'success',
      results: notifications.length,
      data: {
        notifications
      }
    });
  } catch (err) {
    next(err);
  }
});

// Mark notification as read
router.put('/notifications/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const notification = await Notification.findById(id);
    
    if (!notification) {
      return next(new AppError(404, 'Notification not found'));
    }
    
    if (notification.user_id !== userId) {
      return next(new AppError(403, 'Unauthorized'));
    }
    
    const updatedNotification = await Notification.update(id, {
      is_read: true
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        notification: updatedNotification[0]
      }
    });
  } catch (err) {
    next(err);
  }
});

// Mark all notifications as read
router.put('/notifications/read-all', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    await Notification.markAllAsRead(userId);
    
    res.status(200).json({
      status: 'success',
      data: {
        message: 'All notifications marked as read'
      }
    });
  } catch (err) {
    next(err);
  }
});

// Delete a notification
router.delete('/notifications/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const notification = await Notification.findById(id);
    
    if (!notification) {
      return next(new AppError(404, 'Notification not found'));
    }
    
    if (notification.user_id !== userId) {
      return next(new AppError(403, 'Unauthorized'));
    }
    
    await Notification.delete(id);
    
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Device management for push notifications
router.post('/notifications/devices', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { token, device_type, device_name } = req.body;
    
    if (!token || !device_type) {
      return next(new AppError(400, 'Token and device type are required'));
    }
    
    // Check if device token already exists
    const existingDevice = await Device.findByToken(token);
    
    if (existingDevice) {
      // Update the device if it belongs to the user
      if (existingDevice.user_id !== userId) {
        // Token belongs to another user, remove it from their account and add to this user
        await Device.delete(existingDevice.id);
      } else {
        // Update the existing device
        await Device.update(existingDevice.id, {
          device_name,
          updated_at: new Date()
        });
        
        return res.status(200).json({
          status: 'success',
          data: {
            message: 'Device updated successfully'
          }
        });
      }
    }
    
    // Create new device
    await Device.create({
      user_id: userId,
      token,
      device_type,
      device_name: device_name || 'Unknown device'
    });
    
    res.status(201).json({
      status: 'success',
      data: {
        message: 'Device registered successfully'
      }
    });
  } catch (err) {
    next(err);
  }
});

// Unregister device
router.delete('/notifications/devices/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const userId = req.user.id;
    
    const device = await Device.findByToken(token);
    
    if (device && device.user_id !== userId) {
      return next(new AppError(403, 'Unauthorized'));
    }
    
    if (device) {
      await Device.delete(device.id);
    }
    
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

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
  await redisSub.quit();
  server.close(() => {
    logger.info('Process terminated');
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`Notification Service listening on port ${PORT}`);
});