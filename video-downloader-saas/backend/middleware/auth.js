const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Bảo vệ các route yêu cầu đăng nhập
exports.protect = async (req, res, next) => {
  let token;

  // Kiểm tra header Authorization
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Lấy token từ header
    token = req.headers.authorization.split(' ')[1];
  }

  // Kiểm tra nếu không có token
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Không có quyền truy cập, vui lòng đăng nhập'
    });
  }

  try {
    // Xác minh token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Tìm người dùng từ token
    req.user = await User.findById(decoded.id);

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Không có quyền truy cập, vui lòng đăng nhập'
    });
  }
};

// Cấp quyền truy cập dựa trên vai trò
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Vai trò ${req.user.role} không có quyền truy cập`
      });
    }
    next();
  };
};

// Kiểm tra gói đăng ký
exports.checkSubscription = (req, res, next) => {
  if (req.user.subscription !== 'premium') {
    return res.status(403).json({
      success: false,
      message: 'Tính năng này chỉ dành cho người dùng Premium'
    });
  }
  next();
};