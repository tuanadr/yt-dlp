const express = require('express');
const {
  getVideoInfo,
  downloadVideo,
  getVideoStatus,
  getUserVideos,
  deleteVideo,
  streamVideo
} = require('../controllers/video');

const { protect, checkSubscription } = require('../middleware/auth');

const router = express.Router();

// Tất cả các routes yêu cầu xác thực
router.use(protect);

// Routes cơ bản
router.post('/info', getVideoInfo);
router.post('/download', downloadVideo);
router.get('/', getUserVideos);

// Routes với ID video
router.get('/:id/status', getVideoStatus);
router.get('/:id/download', streamVideo);
router.delete('/:id', deleteVideo);

// Routes yêu cầu gói Premium
router.post('/download/premium', checkSubscription, downloadVideo);

module.exports = router;