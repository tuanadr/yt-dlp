const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Đường dẫn đến thư mục yt-dlp
const YT_DLP_PATH = path.join(__dirname, '../../../');

/**
 * Lấy thông tin video từ URL
 * @param {string} url - URL của video
 * @returns {Promise} - Promise chứa thông tin video
 */
exports.getVideoInfo = (url) => {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      '--dump-json',
      '--no-playlist'
    ];

    const ytDlp = spawn('python', [path.join(YT_DLP_PATH, 'yt_dlp/__main__.py'), ...args]);
    
    let output = '';
    let errorOutput = '';

    ytDlp.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytDlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytDlp.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp exited with code ${code}: ${errorOutput}`));
      }

      try {
        const videoInfo = JSON.parse(output);
        
        // Lọc và định dạng lại thông tin video
        const formattedInfo = {
          title: videoInfo.title,
          thumbnail: videoInfo.thumbnail,
          duration: videoInfo.duration_string || formatDuration(videoInfo.duration),
          formats: videoInfo.formats.map(format => ({
            format_id: format.format_id,
            format_note: format.format_note,
            ext: format.ext,
            resolution: format.resolution || `${format.width}x${format.height}`,
            filesize: format.filesize ? formatFileSize(format.filesize) : 'Unknown',
            vcodec: format.vcodec,
            acodec: format.acodec
          })).filter(format => format.resolution !== 'x' && format.vcodec !== 'none')
        };

        resolve(formattedInfo);
      } catch (error) {
        reject(new Error(`Failed to parse video info: ${error.message}`));
      }
    });
  });
};

/**
 * Tải video từ URL với định dạng đã chọn
 * @param {string} url - URL của video
 * @param {string} formatId - ID định dạng video
 * @param {string} outputDir - Thư mục đầu ra
 * @returns {Promise} - Promise chứa đường dẫn đến file đã tải
 */
exports.downloadVideo = (url, formatId, outputDir) => {
  return new Promise((resolve, reject) => {
    // Tạo tên file duy nhất
    const uniqueId = Date.now();
    const outputPath = path.join(outputDir, `${uniqueId}.%(ext)s`);
    
    const args = [
      url,
      '-f', formatId,
      '-o', outputPath,
      '--no-playlist'
    ];

    const ytDlp = spawn('python', [path.join(YT_DLP_PATH, 'yt_dlp/__main__.py'), ...args]);
    
    let errorOutput = '';
    let outputFile = '';

    ytDlp.stdout.on('data', (data) => {
      const output = data.toString();
      // Tìm tên file đầu ra từ output
      const match = output.match(/\[download\] Destination: (.+)/);
      if (match && match[1]) {
        outputFile = match[1];
      }
    });

    ytDlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytDlp.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp exited with code ${code}: ${errorOutput}`));
      }

      if (!outputFile) {
        // Tìm file đã tải trong thư mục
        const files = fs.readdirSync(outputDir);
        const downloadedFile = files.find(file => file.startsWith(uniqueId.toString()));
        
        if (downloadedFile) {
          outputFile = path.join(outputDir, downloadedFile);
        } else {
          return reject(new Error('Không tìm thấy file đã tải'));
        }
      }

      resolve(outputFile);
    });
  });
};

/**
 * Định dạng thời lượng video
 * @param {number} seconds - Thời lượng tính bằng giây
 * @returns {string} - Thời lượng định dạng HH:MM:SS
 */
function formatDuration(seconds) {
  if (!seconds) return 'Unknown';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return [
    hours > 0 ? hours.toString().padStart(2, '0') : null,
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].filter(Boolean).join(':');
}

/**
 * Định dạng kích thước file
 * @param {number} bytes - Kích thước tính bằng bytes
 * @returns {string} - Kích thước định dạng với đơn vị phù hợp
 */
function formatFileSize(bytes) {
  if (!bytes) return 'Unknown';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}