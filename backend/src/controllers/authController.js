const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const { createSendToken } = require('../middleware/auth');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { redisClient } = require('../config/redis');
const mongoService = require('../services/mongoService');

// Register new user
const register = catchAsync(async (req, res, next) => {
  const { username, email, password, first_name, last_name, role = 'viewer' } = req.body;
  
  // Check if user already exists
  try {
    const db = mongoService.getDb();
    const usersCollection = db.collection('users');
    
    const existingUser = await usersCollection.findOne({
      $or: [
        { email: email },
        { username: username }
      ]
    });
    
    if (existingUser) {
      logger.logAuth('registration_failed', 'unknown', false, {
        reason: 'user_exists',
        email,
        username
      });
      return next(new AppError('User with this email or username already exists', 409));
    }
  } catch (error) {
    logger.error('Database error during user existence check:', error);
    return next(new AppError('Registration failed', 500));
  }
  
  // Hash password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  
  // Create user in MongoDB
  let result;
  try {
    const db = mongoService.getDb();
    const usersCollection = db.collection('users');
    const auditLogCollection = db.collection('audit_log');
    
    const userId = uuidv4();
    const now = new Date();
    
    // Insert user
    const newUser = {
      _id: userId,
      username,
      email,
      password: hashedPassword,
      first_name,
      last_name,
      role,
      is_active: true,
      created_at: now,
      updated_at: now
    };
    
    await usersCollection.insertOne(newUser);
    
    // Log user creation in audit log
    await auditLogCollection.insertOne({
      user_id: userId,
      action: 'CREATE',
      resource_type: 'user',
      resource_id: userId,
      details: { username, email, role },
      timestamp: now
    });
    
    result = {
      id: userId,
      username,
      email,
      first_name,
      last_name,
      role,
      is_active: true,
      created_at: now,
      updated_at: now
    };
  } catch (error) {
    logger.error('Database error during user creation:', error);
    return next(new AppError('Registration failed', 500));
  }
  
  logger.logAuth('registration_success', result.id, true, {
    username: result.username,
    email: result.email,
    role: result.role
  });
  
  // Send token response
  createSendToken(result, 201, res, 'User registered successfully');
});

// Login user
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  
  // Check if user exists and is active
  let user;
  try {
    const db = mongoService.getDb();
    const usersCollection = db.collection('users');
    
    user = await usersCollection.findOne({
      email: email,
      is_active: true
    });
    
    if (!user) {
      logger.logAuth('login_failed', 'unknown', false, {
        reason: 'user_not_found',
        email,
        ip: req.ip
      });
      return next(new AppError('Invalid email or password', 401));
    }
    
    // Check password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    
    if (!isPasswordCorrect) {
      logger.logAuth('login_failed', user._id, false, {
        reason: 'invalid_password',
        email,
        ip: req.ip
      });
      return next(new AppError('Invalid email or password', 401));
    }
    
    // Update last login
    await usersCollection.updateOne(
      { _id: user._id },
      { 
        $set: { 
          last_login: new Date(),
          updated_at: new Date()
        }
      }
    );
  } catch (error) {
    logger.error('Database error during login:', error);
    return next(new AppError('Login failed', 500));
  }
  
  // Cache user session info
  await redisClient.hset(`user:${user._id}:session`, 'last_login', new Date().toISOString());
  
  // Send token response
  createSendToken(user, 200, res, 'Login successful');
});

// Get current user profile
const getMe = catchAsync(async (req, res, next) => {
  const user = { ...req.user };
  delete user.password;
  
  res.status(200).json({
    success: true,
    data: user,
    timestamp: new Date().toISOString()
  });
});

// Update user profile
const updateProfile = catchAsync(async (req, res, next) => {
  const userId = req.user._id || req.user.id;
  const { first_name, last_name, email } = req.body;
  
  try {
    const db = mongoService.getDb();
    const usersCollection = db.collection('users');
    
    // Check if email is being changed and if it already exists
    if (email && email !== req.user.email) {
      const existingUser = await usersCollection.findOne({
        email: email,
        _id: { $ne: userId }
      });
      
      if (existingUser) {
        return next(new AppError('Email already exists', 409));
      }
    }
  
    // Build update object dynamically
    const updateFields = {};
    
    if (first_name !== undefined) {
      updateFields.first_name = first_name;
    }
    
    if (last_name !== undefined) {
      updateFields.last_name = last_name;
    }
    
    if (email !== undefined) {
      updateFields.email = email;
    }
    
    if (Object.keys(updateFields).length === 0) {
      return next(new AppError('No fields to update', 400));
    }
    
    updateFields.updated_at = new Date();
    
    const result = await usersCollection.findOneAndUpdate(
      { _id: userId },
      { $set: updateFields },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return next(new AppError('User not found', 404));
    }
    
    const updatedUser = result.value;
    
    // Log profile update
    const auditLogCollection = db.collection('audit_log');
    await auditLogCollection.insertOne({
      user_id: userId,
      action: 'UPDATE',
      resource_type: 'user',
      resource_id: userId,
      details: updateFields,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Database error during profile update:', error);
    return next(new AppError('Profile update failed', 500));
  }
  
  logger.info(`User profile updated: ${userId}`, {
    updated_fields: Object.keys(req.body)
  });
  
  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: updatedUser,
    timestamp: new Date().toISOString()
  });
});

// Change password
const changePassword = catchAsync(async (req, res, next) => {
  const userId = req.user._id || req.user.id;
  const { currentPassword, newPassword } = req.body;
  
  try {
    const db = mongoService.getDb();
    const usersCollection = db.collection('users');
    
    // Get current user with password
    const user = await usersCollection.findOne({ _id: userId });
    
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    
    // Check current password
    const isCurrentPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    
    if (!isCurrentPasswordCorrect) {
      logger.logAuth('password_change_failed', userId, false, {
        reason: 'invalid_current_password'
      });
      return next(new AppError('Current password is incorrect', 400));
    }
    
    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    
    if (isSamePassword) {
      return next(new AppError('New password must be different from current password', 400));
    }
    
    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    await usersCollection.updateOne(
      { _id: userId },
      { 
        $set: { 
          password: hashedNewPassword,
          password_changed_at: new Date(),
          updated_at: new Date()
        }
      }
    );
    
    // Invalidate all existing refresh tokens for this user
    await redisClient.del(`refresh_token:${userId}`);
    
    // Log password change
    const auditLogCollection = db.collection('audit_log');
    await auditLogCollection.insertOne({
      user_id: userId,
      action: 'UPDATE',
      resource_type: 'user_password',
      resource_id: userId,
      details: { action: 'password_changed' },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Database error during password change:', error);
    return next(new AppError('Password change failed', 500));
  }
  
  logger.logAuth('password_changed', userId, true);
  
  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
    timestamp: new Date().toISOString()
  });
});

// Get user statistics (admin only)
const getUserStats = catchAsync(async (req, res, next) => {
  try {
    const db = mongoService.getDb();
    const usersCollection = db.collection('users');
    
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const [totalUsers, activeUsers, adminUsers, operatorUsers, viewerUsers, usersLast24h, newUsersLast30d] = await Promise.all([
      usersCollection.countDocuments({}),
      usersCollection.countDocuments({ is_active: true }),
      usersCollection.countDocuments({ role: 'admin' }),
      usersCollection.countDocuments({ role: 'operator' }),
      usersCollection.countDocuments({ role: 'viewer' }),
      usersCollection.countDocuments({ last_login: { $gt: last24Hours } }),
      usersCollection.countDocuments({ created_at: { $gt: last30Days } })
    ]);
    
    const stats = {
      total_users: totalUsers,
      active_users: activeUsers,
      admin_users: adminUsers,
      operator_users: operatorUsers,
      viewer_users: viewerUsers,
      users_last_24h: usersLast24h,
      new_users_last_30d: newUsersLast30d
    };
    
    res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Database error during user stats retrieval:', error);
    return next(new AppError('Failed to retrieve user statistics', 500));
  }
});

// Get all users (admin only)
const getAllUsers = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, search = '', role = '', status = '' } = req.query;
  
  try {
    const db = mongoService.getDb();
    const usersCollection = db.collection('users');
    
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { first_name: { $regex: search, $options: 'i' } },
        { last_name: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      filter.role = role;
    }
    
    if (status === 'active') {
      filter.is_active = true;
    } else if (status === 'inactive') {
      filter.is_active = false;
    }
    
    // Get total count
    const totalUsers = await usersCollection.countDocuments(filter);
    
    // Get users
    const users = await usersCollection
      .find(filter, {
        projection: {
          password: 0 // Exclude password field
        }
      })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    
    res.status(200).json({
      success: true,
      data: {
          users: users,
         pagination: {
           page: parseInt(page),
           limit: parseInt(limit),
           total: totalUsers,
           pages: Math.ceil(totalUsers / limit)
         }
       },
       timestamp: new Date().toISOString()
     });
   } catch (error) {
     logger.error('Database error during users retrieval:', error);
     return next(new AppError('Failed to retrieve users', 500));
   }
});

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  getUserStats,
  getAllUsers
};