import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const VideoDownloadPage = () => {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [videoId, setVideoId] = useState(null);

  const handleUrlChange = (e) => {
    setUrl(e.target.value);
    // Reset state khi URL thay đổi
    setVideoInfo(null);
    setSelectedFormat('');
    setError(null);
    setDownloadStatus(null);
  };

  const handleGetInfo = async (e) => {
    e.preventDefault();
    
    if (!url) {
      setError('Vui lòng nhập URL video');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await axios.post('/api/videos/info', { url });
      setVideoInfo(res.data.data);
      
      // Tự động chọn định dạng đầu tiên nếu có
      if (res.data.data.formats && res.data.data.formats.length > 0) {
        setSelectedFormat(res.data.data.formats[0].format_id);
      }
    } catch (error) {
      console.error('Lỗi khi lấy thông tin video:', error);
      setError(
        error.response?.data?.message || 
        'Không thể lấy thông tin video. Vui lòng kiểm tra URL và thử lại.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!url) {
      setError('Vui lòng nhập URL video');
      return;
    }
    
    setLoading(true);
    setError(null);
    setDownloadStatus('pending');
    setDownloadProgress(0);
    
    try {
      // Gửi yêu cầu tải xuống
      const res = await axios.post('/api/videos/download', {
        url,
        formatId: selectedFormat,
        title: videoInfo?.title
      });
      
      // Lấy ID video để kiểm tra trạng thái
      const downloadVideoId = res.data.data.videoId;
      setVideoId(downloadVideoId);
      
      // Bắt đầu kiểm tra trạng thái
      checkDownloadStatus(downloadVideoId);
    } catch (error) {
      console.error('Lỗi khi tải video:', error);
      setError(
        error.response?.data?.message || 
        'Không thể tải video. Vui lòng thử lại sau.'
      );
      setDownloadStatus('failed');
      setLoading(false);
    }
  };

  const checkDownloadStatus = async (id) => {
    try {
      const res = await axios.get(`/api/videos/${id}/status`);
      const status = res.data.data.status;
      
      setDownloadStatus(status);
      
      // Cập nhật tiến trình tải xuống
      switch (status) {
        case 'pending':
          setDownloadProgress(10);
          break;
        case 'processing':
          setDownloadProgress(50);
          break;
        case 'completed':
          setDownloadProgress(100);
          setLoading(false);
          break;
        case 'failed':
          setError('Tải video thất bại. Vui lòng thử lại.');
          setLoading(false);
          break;
        default:
          break;
      }
      
      // Tiếp tục kiểm tra nếu chưa hoàn thành
      if (status === 'pending' || status === 'processing') {
        setTimeout(() => checkDownloadStatus(id), 2000);
      }
    } catch (error) {
      console.error('Lỗi khi kiểm tra trạng thái tải xuống:', error);
      setError('Không thể kiểm tra trạng thái tải xuống. Vui lòng thử lại.');
      setDownloadStatus('failed');
      setLoading(false);
    }
  };

  const handleStreamVideo = (id) => {
    window.open(`/api/videos/${id}/download`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h1 className="text-lg leading-6 font-medium text-gray-900">
              Tải video
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Nhập URL video từ YouTube, Facebook, Twitter và nhiều nguồn khác để tải xuống.
            </p>
          </div>
          
          {/* Thông tin gói đăng ký */}
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-500">Gói hiện tại:</span>
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  user?.subscription === 'premium' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {user?.subscription === 'premium' ? 'Premium' : 'Miễn phí'}
                </span>
              </div>
              
              {user?.subscription !== 'premium' && (
                <a
                  href="/dashboard/subscription"
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Nâng cấp lên Premium
                </a>
              )}
            </div>
            
            {user?.subscription !== 'premium' && (
              <p className="mt-2 text-sm text-gray-500">
                Bạn đang sử dụng gói Miễn phí. Giới hạn tải xuống: 3 video/ngày, chất lượng cơ bản.
              </p>
            )}
          </div>
          
          {/* Form nhập URL */}
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <form onSubmit={handleGetInfo} className="space-y-4">
              <div>
                <label htmlFor="video-url" className="block text-sm font-medium text-gray-700">
                  URL Video
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="text"
                    name="video-url"
                    id="video-url"
                    value={url}
                    onChange={handleUrlChange}
                    className="focus:ring-primary-500 focus:border-primary-500 flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <button
                    type="submit"
                    disabled={loading && !videoInfo}
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                      loading && !videoInfo ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    {loading && !videoInfo ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Đang xử lý...
                      </>
                    ) : (
                      'Lấy thông tin'
                    )}
                  </button>
                </div>
              </div>
            </form>
            
            {error && (
              <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Thông tin video */}
          {videoInfo && (
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Thông tin video
              </h3>
              
              <div className="mt-4 flex flex-col md:flex-row">
                {videoInfo.thumbnail && (
                  <div className="flex-shrink-0 mb-4 md:mb-0 md:mr-6">
                    <img
                      src={videoInfo.thumbnail}
                      alt={videoInfo.title}
                      className="w-full md:w-64 h-auto rounded-lg shadow-sm"
                    />
                  </div>
                )}
                
                <div className="flex-1">
                  <h4 className="text-xl font-semibold">{videoInfo.title}</h4>
                  
                  <div className="mt-2 text-sm text-gray-500">
                    <p>Thời lượng: {videoInfo.duration || 'Không xác định'}</p>
                  </div>
                  
                  {/* Chọn định dạng - chỉ cho người dùng Premium */}
                  {user?.subscription === 'premium' && videoInfo.formats && videoInfo.formats.length > 0 && (
                    <div className="mt-4">
                      <label htmlFor="format" className="block text-sm font-medium text-gray-700">
                        Chọn định dạng
                      </label>
                      <select
                        id="format"
                        name="format"
                        value={selectedFormat}
                        onChange={(e) => setSelectedFormat(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                      >
                        {videoInfo.formats.map((format) => (
                          <option key={format.format_id} value={format.format_id}>
                            {format.resolution} - {format.ext} {format.filesize ? `(${format.filesize})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={loading}
                      className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                        loading ? 'opacity-70 cursor-not-allowed' : ''
                      }`}
                    >
                      {loading && downloadStatus !== 'completed' ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Đang tải xuống...
                        </>
                      ) : (
                        'Tải xuống'
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Hiển thị tiến trình tải xuống */}
              {downloadStatus && downloadStatus !== 'failed' && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700">
                    Tiến trình tải xuống
                  </h4>
                  <div className="mt-2 relative pt-1">
                    <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-primary-200">
                      <div
                        style={{ width: `${downloadProgress}%` }}
                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary-500 transition-all duration-500"
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {downloadStatus === 'pending' && 'Đang chuẩn bị...'}
                        {downloadStatus === 'processing' && 'Đang xử lý...'}
                        {downloadStatus === 'completed' && 'Hoàn thành!'}
                      </span>
                      <span>{downloadProgress}%</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Hiển thị nút tải xuống khi hoàn thành */}
              {downloadStatus === 'completed' && videoId && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleStreamVideo(videoId)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Tải xuống video
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoDownloadPage;