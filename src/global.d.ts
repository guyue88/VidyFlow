// 全局类型定义
export interface ElectronAPI {
  // 文件夹选择
  selectDownloadFolder: () => Promise<string | null>;

  // 视频下载
  downloadVideo: (options: DownloadOptions) => Promise<DownloadResult>;
  getVideoInfo: (url: string) => Promise<VideoInfo | { error: string }>;

  // 文件操作
  openFolder: (path: string) => Promise<void>;
  getDefaultDownloadPath: () => Promise<string>;

  // 依赖管理
  checkDependencies: () => Promise<DependencyStatus>;
  installDependencies: () => Promise<{ success: boolean; error?: string }>;

  // 事件监听
  onDownloadProgress: (callback: (data: ProgressData) => void) => void;
  onDownloadError: (callback: (error: string) => void) => void;
  onDependencyInstallProgress: (
    callback: (data: DependencyInstallProgress) => void
  ) => void;

  // 移除事件监听器
  removeAllListeners: (channel: string) => void;
}

export interface DownloadOptions {
  url: string;
  outputPath: string;
  quality: string;
}

export interface DownloadResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface VideoInfo {
  title?: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
  formats?: Array<{ height?: number; [key: string]: unknown }>;
}

export interface ProgressData {
  raw: string;
  stage: string;
  timestamp: number;
  downloaded: number;
  total: number;
  percentage: number;
  speed: string;
  eta: string;
  completed: boolean;
}

export interface DependencyStatus {
  ytDlp: {
    installed: boolean;
    version?: string;
    path?: string;
  };
  ffmpeg: {
    installed: boolean;
    version?: string;
    path?: string;
  };
}

export interface DependencyInstallProgress {
  dependency: string;
  progress: number;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
