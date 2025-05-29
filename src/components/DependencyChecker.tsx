import React, { useState, useEffect } from 'react';
import { AlertTriangle, Download, CheckCircle, Loader2 } from 'lucide-react';
import { DependencyStatus, DependencyInstallProgress } from '../global';

interface DependencyCheckerProps {
  onDependenciesReady: () => void;
}

export const DependencyChecker: React.FC<DependencyCheckerProps> = ({
  onDependenciesReady,
}) => {
  const [status, setStatus] = useState<DependencyStatus | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<{
    [key: string]: number;
  }>({});
  const [error, setError] = useState<string | null>(null);

  // 检查依赖状态
  const checkDependencies = async () => {
    try {
      const dependencyStatus = await window.electronAPI.checkDependencies();
      setStatus(dependencyStatus);

      // 如果所有依赖都已安装，通知父组件
      if (
        dependencyStatus.ytDlp.installed &&
        dependencyStatus.ffmpeg.installed
      ) {
        onDependenciesReady();
      }
    } catch (error) {
      console.error('检查依赖失败:', error);
      setError('检查依赖失败');
    }
  };

  // 安装缺失的依赖
  const installDependencies = async () => {
    setIsInstalling(true);
    setError(null);
    setInstallProgress({});

    try {
      // 监听安装进度
      window.electronAPI.onDependencyInstallProgress(
        (data: DependencyInstallProgress) => {
          setInstallProgress(prev => ({
            ...prev,
            [data.dependency]: data.progress,
          }));
        }
      );

      const result = await window.electronAPI.installDependencies();

      if (result.success) {
        // 重新检查依赖状态
        await checkDependencies();
      } else {
        setError(result.error || '安装依赖失败');
      }
    } catch (error) {
      console.error('安装依赖失败:', error);
      setError('安装依赖失败');
    } finally {
      setIsInstalling(false);
      // 清理事件监听器
      window.electronAPI.removeAllListeners('dependency-install-progress');
    }
  };

  useEffect(() => {
    checkDependencies();
  }, []);

  if (!status) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">正在检查依赖...</p>
        </div>
      </div>
    );
  }

  const missingDependencies = [];
  if (!status.ytDlp.installed) missingDependencies.push('yt-dlp');
  if (!status.ffmpeg.installed) missingDependencies.push('ffmpeg');

  if (missingDependencies.length === 0) {
    return null; // 所有依赖都已安装，不显示此组件
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            缺少必要依赖
          </h2>
          <p className="text-gray-600">VidyFlow需要以下依赖才能正常工作：</p>
        </div>

        <div className="space-y-4 mb-6">
          {/* yt-dlp状态 */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              {status.ytDlp.installed ? (
                <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-500 mr-3" />
              )}
              <div>
                <p className="font-medium">yt-dlp</p>
                <p className="text-sm text-gray-500">视频下载引擎</p>
              </div>
            </div>
            <div className="text-right">
              {status.ytDlp.installed ? (
                <span className="text-green-600 text-sm">
                  v{status.ytDlp.version}
                </span>
              ) : (
                <span className="text-yellow-600 text-sm">未安装</span>
              )}
            </div>
          </div>

          {/* ffmpeg状态 */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              {status.ffmpeg.installed ? (
                <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-500 mr-3" />
              )}
              <div>
                <p className="font-medium">ffmpeg</p>
                <p className="text-sm text-gray-500">音视频处理工具</p>
              </div>
            </div>
            <div className="text-right">
              {status.ffmpeg.installed ? (
                <span className="text-green-600 text-sm">
                  v{status.ffmpeg.version}
                </span>
              ) : (
                <span className="text-yellow-600 text-sm">未安装</span>
              )}
            </div>
          </div>
        </div>

        {/* 安装进度 */}
        {isInstalling && (
          <div className="mb-6">
            <h3 className="font-medium mb-3">安装进度</h3>
            {Object.entries(installProgress).map(([dependency, progress]) => (
              <div key={dependency} className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span>{dependency}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 错误信息 */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex space-x-3">
          <button
            onClick={installDependencies}
            disabled={isInstalling}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isInstalling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                安装中...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                自动安装
              </>
            )}
          </button>

          <button
            onClick={checkDependencies}
            disabled={isInstalling}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            重新检查
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">
          <p>依赖将自动下载到应用数据目录，不会影响系统环境</p>
        </div>
      </div>
    </div>
  );
};
