// libs/middleware/auth.js
const jwt = require('jsonwebtoken');
const { AppError } = require('@yourride/common');

// Middleware to verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError(401, 'Not authenticated. Please login.'));
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError(401, 'Invalid token. Please login again.'));
    }
    if (err.name === 'TokenExpiredError') {
      return next(new AppError(401, 'Token expired. Please login again.'));
    }
    next(err);
  }
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.user_type)) {
      return next(new AppError(403, 'Not authorized to access this resource'));
    }
    next();
  };
};

module.exports = { authenticate, authorize };