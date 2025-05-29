import React, { useState, useEffect } from 'react';
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
  stage: string;
  stageProgress: { [key: string]: number };
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
  const [downloadPath, setDownloadPath] = useState('~/Downloads');
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [isLoading, setIsLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] =
    useState<DownloadProgress | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  // 监听下载进度
  useEffect(() => {
    const handleDownloadProgress = (
      progressData:
        | string
        | {
            raw: string;
            stage: string;
            timestamp: number;
            downloaded?: number;
            total?: number;
            percentage?: number;
            speed?: string;
            eta?: string;
            completed?: boolean;
          }
    ) => {
      // 处理新的进度数据格式
      if (typeof progressData === 'string') {
        // 兼容旧格式
        parseProgressString(progressData);
      } else if (progressData && progressData.raw) {
        // 新格式
        parseProgressData(progressData);
      }
    };

    const parseProgressString = (data: string) => {
      if (data.includes('%')) {
        const progressMatch = data.match(/(\d+\.?\d*)%/);
        const speedMatch = data.match(/(\d+\.?\d*\w+\/s)/);
        const etaMatch = data.match(/ETA (\d+:\d+)/);

        if (progressMatch) {
          const progress = parseFloat(progressMatch[1]);
          setDownloadProgress(prev =>
            prev
              ? {
                  ...prev,
                  progress,
                  speed: speedMatch ? speedMatch[1] : prev.speed,
                  eta: etaMatch ? etaMatch[1] : prev.eta,
                }
              : null
          );
        }
      }
    };

    const parseProgressData = (progressData: {
      raw: string;
      stage: string;
      timestamp: number;
      downloaded?: number;
      total?: number;
      percentage?: number;
      speed?: string;
      eta?: string;
      completed?: boolean;
    }) => {
      const {
        raw,
        stage,
        downloaded,
        total,
        percentage,
        speed,
        eta,
        completed,
      } = progressData;

      setDownloadProgress(prev => {
        if (!prev) return null;

        const newProgress = { ...prev };
        newProgress.stage = stage;

        // 如果主进程已经解析了数据，直接使用
        if (downloaded !== undefined && total !== undefined) {
          newProgress.downloaded = downloaded;
          newProgress.total = total;

          // 使用百分比或计算百分比
          const currentPercentage =
            percentage !== undefined
              ? percentage
              : total > 0
                ? (downloaded / total) * 100
                : 0;

          // 更新阶段进度
          newProgress.stageProgress[stage] = currentPercentage;

          // 如果是单文件下载（没有音视频分离），直接使用百分比
          if (stage === 'video' && !raw.includes('audio')) {
            newProgress.progress = currentPercentage;
          } else {
            // 计算总体进度（多阶段下载）
            const stageWeights = {
              preparing: 5,
              video: 45,
              audio: 35,
              merging: 10,
              processing: 5,
            };

            let totalProgress = 0;
            let completedWeight = 0;

            const stageOrder = [
              'preparing',
              'video',
              'audio',
              'merging',
              'processing',
            ];
            const currentStageIndex = stageOrder.indexOf(stage);

            // 计算已完成阶段的权重
            for (let i = 0; i < currentStageIndex; i++) {
              completedWeight +=
                stageWeights[stageOrder[i] as keyof typeof stageWeights] || 0;
            }

            // 计算当前阶段的进度
            const currentStageWeight =
              stageWeights[stage as keyof typeof stageWeights] || 0;
            totalProgress =
              completedWeight + (currentPercentage * currentStageWeight) / 100;

            newProgress.progress = Math.min(totalProgress, 100);
          }
        }

        // 更新速度和ETA
        if (speed) {
          newProgress.speed = speed;
        }
        if (eta) {
          newProgress.eta = eta;
        }

        // 如果下载完成
        if (completed) {
          newProgress.progress = 100;
          newProgress.eta = '00:00';
        }

        return newProgress;
      });
    };

    const handleDownloadError = (error: string) => {
      console.error('Download error:', error);
    };

    window.electronAPI.onDownloadProgress(handleDownloadProgress);
    window.electronAPI.onDownloadError(handleDownloadError);

    return () => {
      window.electronAPI.removeAllListeners('download-progress');
      window.electronAPI.removeAllListeners('download-error');
    };
  }, []);

  // 初始化默认下载路径
  useEffect(() => {
    const initializeDownloadPath = async () => {
      try {
        const defaultPath = await window.electronAPI.getDefaultDownloadPath();
        setDownloadPath(defaultPath);
      } catch (error) {
        console.error('获取默认下载路径失败:', error);
        // 保持默认值
      }
    };

    initializeDownloadPath();
  }, []);

  // 获取视频信息
  const handleGetVideoInfo = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    try {
      const result = await window.electronAPI.getVideoInfo(url);

      if ('error' in result) {
        alert(`获取视频信息失败: ${result.error}`);
        return;
      }

      // 格式化时长
      const formatDuration = (seconds?: number) => {
        if (!seconds) return 'Unknown';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
          return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
      };

      // 提取可用的质量选项
      const availableQualities = result.formats
        ?.filter(format => format.height)
        .map(format => `${format.height}p`)
        .filter((quality, index, arr) => arr.indexOf(quality) === index)
        .sort((a, b) => parseInt(b) - parseInt(a)) || ['best'];

      setVideoInfo({
        title: result.title || 'Unknown Title',
        author: result.uploader || 'Unknown Author',
        duration: formatDuration(result.duration),
        thumbnail:
          result.thumbnail ||
          'https://via.placeholder.com/160x90/3B82F6/ffffff?text=Video',
        quality:
          availableQualities.length > 0
            ? availableQualities
            : ['best', '720p', '480p', '360p'],
      });

      // 设置默认质量
      if (availableQualities.length > 0) {
        setSelectedQuality(availableQualities[0]);
      }
    } catch (error) {
      console.error('获取视频信息失败:', error);
      alert(`获取视频信息失败: ${error}`);
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
      total: 0,
      speed: '0 MB/s',
      eta: '计算中...',
      stage: 'initial',
      stageProgress: {},
    });

    try {
      const result = await window.electronAPI.downloadVideo({
        url,
        outputPath: downloadPath,
        quality: selectedQuality,
      });

      if (result.success) {
        // 添加到历史记录
        const newHistoryItem: HistoryItem = {
          id: Date.now().toString(),
          title: videoInfo.title,
          fileName: `${videoInfo.title}.mp4`,
          downloadTime: new Date().toLocaleString('zh-CN'),
          size: 'Unknown',
          quality: selectedQuality,
          status: 'success',
          filePath: downloadPath,
        };

        setHistory(prev => [newHistoryItem, ...prev]);

        // 重置状态
        setTimeout(() => {
          setDownloadProgress(null);
          setIsDownloading(false);
          setUrl('');
          setVideoInfo(null);
        }, 2000);
      } else {
        throw new Error(result.error || '下载失败');
      }
    } catch (error) {
      console.error('下载失败:', error);

      // 添加失败记录到历史
      const failedHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        title: videoInfo.title,
        fileName: `${videoInfo.title}.mp4`,
        downloadTime: new Date().toLocaleString('zh-CN'),
        size: 'Unknown',
        quality: selectedQuality,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : '未知错误',
        filePath: downloadPath,
      };

      setHistory(prev => [failedHistoryItem, ...prev]);
      setIsDownloading(false);
      setDownloadProgress(null);
      alert(`下载失败: ${error}`);
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

  // 辅助函数：格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
  };

  // 辅助函数：获取阶段显示名称
  const getStageDisplayName = (stage: string): string => {
    const stageNames: { [key: string]: string } = {
      preparing: '准备中',
      initial: '初始化',
      video: '下载视频',
      audio: '下载音频',
      merging: '合并文件',
      processing: '后处理',
    };

    return stageNames[stage] || stage;
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
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="w-5 h-5 text-slate-600" />
              <span className="font-medium text-slate-700">下载进度</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {getStageDisplayName(downloadProgress.stage)}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">
                  正在下载: {downloadProgress.fileName}
                </span>
                <span className="font-medium text-blue-600">
                  {downloadProgress.progress.toFixed(1)}%
                </span>
              </div>

              <div className="w-full bg-slate-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${downloadProgress.progress}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">已下载:</span>
                    <span className="font-medium text-slate-700">
                      {formatFileSize(downloadProgress.downloaded)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">总大小:</span>
                    <span className="font-medium text-slate-700">
                      {downloadProgress.total > 0
                        ? formatFileSize(downloadProgress.total)
                        : '计算中...'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">下载速度:</span>
                    <span className="font-medium text-slate-700">
                      {downloadProgress.speed}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">预计剩余:</span>
                    <span className="font-medium text-slate-700">
                      {downloadProgress.eta}
                    </span>
                  </div>
                </div>
              </div>

              {/* 阶段进度详情 */}
              {Object.keys(downloadProgress.stageProgress).length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="text-xs text-slate-500 mb-2">阶段详情:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(downloadProgress.stageProgress).map(
                      ([stage, progress]) => (
                        <div key={stage} className="flex justify-between">
                          <span className="text-slate-500">
                            {getStageDisplayName(stage)}:
                          </span>
                          <span
                            className={`font-medium ${stage === downloadProgress.stage ? 'text-blue-600' : 'text-green-600'}`}
                          >
                            {progress.toFixed(1)}%
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
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
