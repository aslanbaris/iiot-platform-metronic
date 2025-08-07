const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const { AppError, catchAsync } = require('./errorHandler');
const logger = require('../utils/logger');
const { redisClient } = require('../config/redis');
const mongoService = require('../services/mongoService');

// Generate JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

// Generate refresh token
const signRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  });
};

// Create and send token response
const createSendToken = async (user, statusCode, res, message = 'Success') => {
  const token = signToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  
  // Store refresh token in Redis
  const refreshTokenKey = `refresh_token:${user.id}`;
  await redisClient.set(refreshTokenKey, refreshToken, 7 * 24 * 60 * 60); // 7 days
  
  // Remove password from output
  const userOutput = { ...user };
  delete userOutput.password;
  
  // Log successful authentication
  logger.logAuth('login', user.id, true, {
    username: user.username,
    email: user.email
  });
  
  res.status(statusCode).json({
    success: true,
    message,
    data: {
      token,
      refreshToken,
      user: userOutput
    },
    timestamp: new Date().toISOString()
  });
};

// Protect routes - verify JWT token
const protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token'];
  }

  if (!token) {
    logger.logAuth('access_denied', 'unknown', false, {
      reason: 'no_token',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    return next(new AppError('You are not logged in! Please log in to get access.', 401));
  }

  // 2) Verification token
  let decoded;
  try {
    decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  } catch (error) {
    logger.logAuth('access_denied', 'unknown', false, {
      reason: 'invalid_token',
      error: error.message,
      ip: req.ip
    });
    
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired! Please log in again.', 401));
    }
    return next(new AppError('Invalid token. Please log in again!', 401));
  }

  // 3) Check if user still exists
  try {
    const db = mongoService.getDb();
    const usersCollection = db.collection('users');
    
    const currentUser = await usersCollection.findOne({
      _id: decoded.id,
      is_active: true
    });
    
    if (!currentUser) {
      logger.logAuth('access_denied', decoded.id, false, {
        reason: 'user_not_found',
        ip: req.ip
      });
      return next(new AppError('The user belonging to this token does no longer exist.', 401));
    }
    
    req.user = currentUser;
  } catch (error) {
    logger.error('Database error during user verification:', error);
    return next(new AppError('Authentication failed', 500));
  }

  // 4) Check if user changed password after the token was issued
  if (currentUser.password_changed_at) {
    const passwordChangedAt = new Date(currentUser.password_changed_at);
    const tokenIssuedAt = new Date(decoded.iat * 1000);
    
    if (passwordChangedAt > tokenIssuedAt) {
      logger.logAuth('access_denied', decoded.id, false, {
        reason: 'password_changed',
        ip: req.ip
      });
      return next(new AppError('User recently changed password! Please log in again.', 401));
    }
  }

  // 5) Check if token is blacklisted
  const isBlacklisted = await redisClient.exists(`blacklist:${token}`);
  if (isBlacklisted) {
    logger.logAuth('access_denied', decoded.id, false, {
      reason: 'token_blacklisted',
      ip: req.ip
    });
    return next(new AppError('Token has been invalidated. Please log in again.', 401));
  }

  // Grant access to protected route
  req.token = token;
  
  // Update last activity
  try {
    const db = mongoService.getDb();
    const usersCollection = db.collection('users');
    
    await usersCollection.updateOne(
      { _id: currentUser._id },
      { 
        $set: { 
          last_login: new Date(),
          updated_at: new Date()
        }
      }
    );
  } catch (error) {
    logger.error('Error updating user last activity:', error);
    // Don't fail the request for this non-critical update
  }
  
  next();
});

// Restrict to certain roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      logger.logAuth('access_denied', req.user.id, false, {
        reason: 'insufficient_permissions',
        required_roles: roles,
        user_role: req.user.role,
        ip: req.ip
      });
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

// Token authentication (similar to protect but simpler)
const authenticateToken = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token'];
  }

  if (!token) {
    return next(new AppError('You are not logged in! Please log in to get access.', 401));
  }

  // 2) Verification token
  let decoded;
  try {
    decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired! Please log in again.', 401));
    }
    return next(new AppError('Invalid token. Please log in again!', 401));
  }

  // 3) Check if user still exists
  try {
    const db = mongoService.getDb();
    const usersCollection = db.collection('users');
    
    const currentUser = await usersCollection.findOne({
      _id: decoded.id,
      is_active: true
    });
    
    if (!currentUser) {
      return next(new AppError('The user belonging to this token does no longer exist.', 401));
    }
    
    req.user = currentUser;
    req.token = token;
  } catch (error) {
    logger.error('Database error during token authentication:', error);
    return next(new AppError('Authentication failed', 500));
  }
  
  next();
});

// API Key authentication for devices
const authenticateApiKey = catchAsync(async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return next(new AppError('API key is required', 401));
  }
  
  // Check if API key exists and is valid
  try {
    const db = mongoService.getDb();
    const devicesCollection = db.collection('devices');
    
    const device = await devicesCollection.findOne({
      api_key: apiKey,
      is_active: true
    });
    
    if (!device) {
      logger.logSecurity('invalid_api_key', 'medium', {
        api_key: apiKey.substring(0, 8) + '...',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return next(new AppError('Invalid API key', 401));
    }
    
    req.device = device;
  } catch (error) {
    logger.error('Database error during API key authentication:', error);
    return next(new AppError('Authentication failed', 500));
  }
  
  // Update device last seen
  try {
    const db = mongoService.getDb();
    const devicesCollection = db.collection('devices');
    
    await devicesCollection.updateOne(
      { _id: device._id },
      { 
        $set: { 
          last_seen: new Date(),
          updated_at: new Date()
        }
      }
    );
  } catch (error) {
    logger.error('Error updating device last seen:', error);
    // Don't fail the request for this non-critical update
  }
  next();
});

// Refresh token
const refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return next(new AppError('Refresh token is required', 400));
  }
  
  // Verify refresh token
  let decoded;
  try {
    decoded = await promisify(jwt.verify)(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    logger.logAuth('refresh_failed', 'unknown', false, {
      reason: 'invalid_refresh_token',
      error: error.message
    });
    return next(new AppError('Invalid refresh token', 401));
  }
  
  // Check if refresh token exists in Redis
  const storedToken = await redisClient.get(`refresh_token:${decoded.id}`);
  if (!storedToken || storedToken !== refreshToken) {
    logger.logAuth('refresh_failed', decoded.id, false, {
      reason: 'refresh_token_not_found'
    });
    return next(new AppError('Refresh token not found or expired', 401));
  }
  
  // Check if user still exists
  try {
    const db = mongoService.getDb();
    const usersCollection = db.collection('users');
    
    const user = await usersCollection.findOne({
      _id: decoded.id,
      is_active: true
    });
    
    if (!user) {
      return next(new AppError('User no longer exists', 401));
    }
    
    // Generate new tokens
     const newToken = signToken(user._id);
     const newRefreshToken = signRefreshToken(user._id);
     
     // Update refresh token in Redis
     await redisClient.set(`refresh_token:${user._id}`, newRefreshToken, 7 * 24 * 60 * 60);
     
     // Remove password from output
     const userOutput = { ...user };
     delete userOutput.password;
     
     logger.logAuth('token_refreshed', user._id, true);
     
     res.status(200).json({
       success: true,
       message: 'Token refreshed successfully',
       data: {
         token: newToken,
         refreshToken: newRefreshToken,
         user: userOutput
       },
       timestamp: new Date().toISOString()
     });
   } catch (error) {
     logger.error('Database error during token refresh:', error);
     return next(new AppError('Token refresh failed', 500));
   }
});

// Logout - blacklist token
const logout = catchAsync(async (req, res, next) => {
  const token = req.token;
  const userId = req.user.id;
  
  // Add token to blacklist
  const decoded = jwt.decode(token);
  const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
  
  if (expiresIn > 0) {
    await redisClient.set(`blacklist:${token}`, 'true', expiresIn);
  }
  
  // Remove refresh token
  await redisClient.del(`refresh_token:${userId}`);
  
  logger.logAuth('logout', userId, true);
  
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
    timestamp: new Date().toISOString()
  });
});

// Optional authentication - doesn't fail if no token
const optionalAuth = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (token) {
    try {
      const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
      const result = await query(
        'SELECT * FROM auth.users WHERE id = $1 AND is_active = true',
        [decoded.id]
      );
      
      if (result.rows.length > 0) {
        req.user = result.rows[0];
      }
    } catch (error) {
      // Ignore errors for optional auth
    }
  }
  
  next();
});

module.exports = {
  signToken,
  signRefreshToken,
  createSendToken,
  protect,
  restrictTo,
  authenticateToken,
  authenticateApiKey,
  refreshToken,
  logout,
  optionalAuth
};