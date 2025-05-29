// 全局类型定义
interface ElectronAPI {
  selectDownloadPath: () => Promise<string | null>;
  downloadVideo: (options: {
    url: string;
    outputPath: string;
    quality: string;
  }) => Promise<{ success: boolean; output?: string; error?: string }>;
  getVideoInfo: (url: string) => Promise<
    | {
        title?: string;
        duration?: number;
        thumbnail?: string;
        uploader?: string;
        formats?: Array<{ height?: number; [key: string]: unknown }>;
      }
    | { error: string }
  >;
  openFolder: (folderPath: string) => Promise<void>;
  onDownloadProgress: (callback: (data: string) => void) => void;
  onDownloadError: (callback: (error: string) => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
