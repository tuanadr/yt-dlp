const path = require('path');
const fs = require('fs');
const Video = require('../models/Video');
const User = require('../models/User');
const ytdlp = require('../utils/ytdlp');

// Thư mục lưu trữ video tạm thời
const DOWNLOAD_DIR = path.join(__dirname, '../downloads');

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

/**
 * @desc    Lấy thông tin video từ URL
 * @route   POST /api/videos/info
 * @access  Private
 */
exports.getVideoInfo = async (req, res, next) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp URL video'
      });
    }

    const videoInfo = await ytdlp.getVideoInfo(url);

    res.status(200).json({
      success: true,
      data: videoInfo
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin video:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể lấy thông tin video',
      error: error.message
    });
  }
};

/**
 * @desc    Tải video từ URL
 * @route   POST /api/videos/download
 * @access  Private
 */
exports.downloadVideo = async (req, res, next) => {
  try {
    const { url, formatId, title } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp URL video'
      });
    }

    // Kiểm tra giới hạn tải xuống cho người dùng miễn phí
    if (req.user.subscription === 'free') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const downloadCount = await Video.countDocuments({
        user: req.user.id,
        createdAt: { $gte: today }
      });
      
      if (downloadCount >= 3) {
        return res.status(403).json({
          success: false,
          message: 'Bạn đã đạt giới hạn tải xuống hàng ngày. Nâng cấp lên Premium để tải không giới hạn.'
        });
      }
    }

    // Tạo bản ghi video trong cơ sở dữ liệu
    const video = await Video.create({
      title: title,
      url: url,
      status: 'processing',
      user: req.user.id
    });

    // Tạo thư mục riêng cho người dùng
    const userDir = path.join(DOWNLOAD_DIR, req.user.id.toString());
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    // Tải video (không chờ đợi - trả về ngay lập tức)
    res.status(202).json({
      success: true,
      message: 'Đang xử lý yêu cầu tải xuống',
      data: {
        videoId: video._id
      }
    });

    // Xử lý tải xuống trong nền
    try {
      // Lấy thông tin video nếu chưa có formatId
      let selectedFormatId = formatId;
      if (!selectedFormatId) {
        const videoInfo = await ytdlp.getVideoInfo(url);
        // Chọn định dạng tốt nhất có sẵn
        if (videoInfo.formats && videoInfo.formats.length > 0) {
          selectedFormatId = videoInfo.formats[0].format_id;
        } else {
          throw new Error('Không tìm thấy định dạng video phù hợp');
        }
      }

      // Tải video
      const downloadPath = await ytdlp.downloadVideo(url, selectedFormatId, userDir);
      
      // Cập nhật thông tin video
      await Video.findByIdAndUpdate(video._id, {
        status: 'completed',
        downloadPath: downloadPath,
        // Đặt thời gian hết hạn dựa trên gói đăng ký
        expiresAt: req.user.subscription === 'premium' 
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)  // 7 ngày cho Premium
          : new Date(Date.now() + 24 * 60 * 60 * 1000)      // 1 ngày cho Free
      });

      // Tăng số lượt tải xuống của người dùng
      await User.findByIdAndUpdate(req.user.id, {
        $inc: { downloadCount: 1 }
      });
    } catch (error) {
      console.error('Lỗi khi tải video:', error);
      await Video.findByIdAndUpdate(video._id, {
        status: 'failed',
        error: error.message
      });
    }
  } catch (error) {
    console.error('Lỗi khi xử lý yêu cầu tải xuống:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể xử lý yêu cầu tải xuống',
      error: error.message
    });
  }
};

/**
 * @desc    Lấy trạng thái tải xuống video
 * @route   GET /api/videos/:id/status
 * @access  Private
 */
exports.getVideoStatus = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy video'
      });
    }

    // Kiểm tra quyền sở hữu
    if (video.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền truy cập video này'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: video._id,
        status: video.status,
        title: video.title,
        url: video.url,
        downloadPath: video.downloadPath,
        createdAt: video.createdAt,
        expiresAt: video.expiresAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Không thể lấy trạng thái video',
      error: error.message
    });
  }
};

/**
 * @desc    Lấy danh sách video của người dùng
 * @route   GET /api/videos
 * @access  Private
 */
exports.getUserVideos = async (req, res, next) => {
  try {
    const videos = await Video.find({ user: req.user.id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: videos.length,
      data: videos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách video',
      error: error.message
    });
  }
};

/**
 * @desc    Xóa video
 * @route   DELETE /api/videos/:id
 * @access  Private
 */
exports.deleteVideo = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy video'
      });
    }

    // Kiểm tra quyền sở hữu
    if (video.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền xóa video này'
      });
    }

    // Xóa file nếu tồn tại
    if (video.downloadPath && fs.existsSync(video.downloadPath)) {
      fs.unlinkSync(video.downloadPath);
    }

    await video.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Video đã được xóa'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Không thể xóa video',
      error: error.message
    });
  }
};

/**
 * @desc    Tải xuống file video
 * @route   GET /api/videos/:id/download
 * @access  Private
 */
exports.streamVideo = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy video'
      });
    }

    // Kiểm tra quyền sở hữu
    if (video.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền truy cập video này'
      });
    }

    // Kiểm tra trạng thái video
    if (video.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Video chưa sẵn sàng để tải xuống'
      });
    }

    // Kiểm tra file tồn tại
    if (!video.downloadPath || !fs.existsSync(video.downloadPath)) {
      return res.status(404).json({
        success: false,
        message: 'File video không tồn tại'
      });
    }

    // Lấy thông tin file
    const stat = fs.statSync(video.downloadPath);
    const fileSize = stat.size;
    const fileName = path.basename(video.downloadPath);
    const fileExt = path.extname(fileName);
    const mimeType = getMimeType(fileExt);

    // Thiết lập headers
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(video.title)}${fileExt}"`);

    // Stream file
    const fileStream = fs.createReadStream(video.downloadPath);
    fileStream.pipe(res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Không thể tải xuống video',
      error: error.message
    });
  }
};

/**
 * Lấy MIME type dựa trên phần mở rộng file
 */
function getMimeType(ext) {
  switch (ext.toLowerCase()) {
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mkv':
      return 'video/x-matroska';
    case '.mp3':
      return 'audio/mpeg';
    case '.m4a':
      return 'audio/mp4';
    default:
      return 'application/octet-stream';
  }
}