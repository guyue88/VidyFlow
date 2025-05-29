import React, { useState } from 'react';
import {
  Download,
  Folder,
  Play,
  Clock,
  User,
  Monitor,
  CheckCircle,
  XCircle,
  RotateCcw,
  Trash2,
  FolderOpen,
  Link,
  Loader2,
} from 'lucide-react';

interface VideoInfo {
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
  quality: string[];
}

interface DownloadProgress {
  fileName: string;
  progress: number;
  downloaded: number;
  total: number;
  speed: string;
  eta: string;
}

interface HistoryItem {
  id: string;
  title: string;
  fileName: string;
  downloadTime: string;
  size: string;
  quality: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  filePath: string;
}

const App: React.FC = () => {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [downloadPath, setDownloadPath] = useState('/Users/Downloads');
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [isLoading, setIsLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] =
    useState<DownloadProgress | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  // 模拟获取视频信息
  const handleGetVideoInfo = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 2000));

      setVideoInfo({
        title: '如何学习编程 - 完整教程指南',
        author: 'TechChannel',
        duration: '25:30',
        thumbnail:
          'https://via.placeholder.com/160x90/3B82F6/ffffff?text=Video',
        quality: ['1080p', '720p', '480p', '360p'],
      });
    } catch (error) {
      console.error('获取视频信息失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 选择下载路径
  const handleSelectPath = async () => {
    try {
      const result = await window.electronAPI.selectDownloadPath();
      if (result) {
        setDownloadPath(result);
      }
    } catch (error) {
      console.error('选择路径失败:', error);
    }
  };

  // 开始下载
  const handleDownload = async () => {
    if (!videoInfo || !url) return;

    setIsDownloading(true);
    setDownloadProgress({
      fileName: `${videoInfo.title}.mp4`,
      progress: 0,
      downloaded: 0,
      total: 147,
      speed: '0 MB/s',
      eta: '计算中...',
    });

    try {
      // 模拟下载进度
      for (let i = 0; i <= 100; i += 5) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setDownloadProgress(prev =>
          prev
            ? {
                ...prev,
                progress: i,
                downloaded: Math.round((i / 100) * 147),
                speed: `${(Math.random() * 5 + 1).toFixed(1)} MB/s`,
                eta: i < 100 ? `${Math.round((100 - i) * 0.3)}秒` : '完成',
              }
            : null
        );
      }

      // 添加到历史记录
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        title: videoInfo.title,
        fileName: `${videoInfo.title}.mp4`,
        downloadTime: new Date().toLocaleString('zh-CN'),
        size: '147MB',
        quality: selectedQuality,
        status: 'success',
        filePath: `${downloadPath}/${videoInfo.title}.mp4`,
      };

      setHistory(prev => [newHistoryItem, ...prev]);

      // 重置状态
      setTimeout(() => {
        setDownloadProgress(null);
        setIsDownloading(false);
        setUrl('');
        setVideoInfo(null);
      }, 2000);
    } catch (error) {
      console.error('下载失败:', error);
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  // 打开文件夹
  const handleOpenFolder = (filePath: string) => {
    window.electronAPI.openFolder(filePath);
  };

  // 删除历史记录
  const handleDeleteHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  // 清空历史记录
  const handleClearHistory = () => {
    setHistory([]);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 头部 */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800">XDown</h1>
            <p className="text-sm text-slate-500 mt-1">视频下载神器</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* URL 输入区域 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="粘贴视频链接..."
                className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                onKeyPress={e => e.key === 'Enter' && handleGetVideoInfo()}
              />
            </div>
            <button
              onClick={handleGetVideoInfo}
              disabled={!url.trim() || isLoading}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 min-w-[100px] justify-center"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                '获取'
              )}
            </button>
          </div>
        </div>

        {/* 视频信息卡片 */}
        {videoInfo && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-slide-in">
            <div className="flex gap-4">
              <img
                src={videoInfo.thumbnail}
                alt="视频缩略图"
                className="w-40 h-24 rounded-lg object-cover bg-slate-100"
              />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  {videoInfo.title}
                </h3>
                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>{videoInfo.author}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{videoInfo.duration}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Monitor className="w-4 h-4" />
                    <span>{selectedQuality}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 设置面板 */}
        {videoInfo && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 下载路径 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Folder className="w-5 h-5 text-slate-600" />
                <span className="font-medium text-slate-700">下载路径</span>
              </div>
              <button
                onClick={handleSelectPath}
                className="w-full text-left text-sm text-slate-600 hover:text-blue-600 transition-colors truncate"
              >
                {downloadPath}
              </button>
            </div>

            {/* 视频质量 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Play className="w-5 h-5 text-slate-600" />
                <span className="font-medium text-slate-700">视频质量</span>
              </div>
              <select
                value={selectedQuality}
                onChange={e => setSelectedQuality(e.target.value)}
                className="w-full text-sm text-slate-600 border-none outline-none bg-transparent"
              >
                {videoInfo.quality.map(quality => (
                  <option key={quality} value={quality}>
                    {quality} HD
                  </option>
                ))}
              </select>
            </div>

            {/* 下载按钮 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full h-full flex items-center justify-center gap-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                <Download className="w-5 h-5" />
                {isDownloading ? '下载中...' : '开始下载'}
              </button>
            </div>
          </div>
        )}

        {/* 下载进度 */}
        {downloadProgress && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <Monitor className="w-5 h-5 text-slate-600" />
              <span className="font-medium text-slate-700">下载进度</span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">
                  正在下载: {downloadProgress.fileName}
                </span>
                <span className="font-medium text-blue-600">
                  {downloadProgress.progress}%
                </span>
              </div>

              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${downloadProgress.progress}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-slate-500">
                <span>
                  {downloadProgress.downloaded}MB / {downloadProgress.total}MB
                </span>
                <span>
                  {downloadProgress.speed} • 预计剩余: {downloadProgress.eta}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 下载历史 */}
        {history.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-slate-600" />
                <span className="font-medium text-slate-700">下载历史</span>
              </div>
              <button
                onClick={handleClearHistory}
                className="text-sm text-slate-500 hover:text-red-600 transition-colors"
              >
                清空历史
              </button>
            </div>

            <div className="divide-y divide-slate-200">
              {history.map(item => (
                <div
                  key={item.id}
                  className="p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {item.status === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className="font-medium text-slate-800 text-sm">
                          {item.fileName}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.downloadTime} • {item.size} • {item.quality}
                        {item.status === 'failed' && item.errorMessage && (
                          <span className="text-red-500">
                            {' '}
                            • {item.errorMessage}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {item.status === 'success' ? (
                        <button
                          onClick={() => handleOpenFolder(item.filePath)}
                          className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          title="打开文件夹"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          title="重新下载"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteHistory(item.id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                        title="删除记录"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
