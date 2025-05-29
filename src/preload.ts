// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// 定义API接口
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

// 暴露API到渲染进程
const electronAPI: ElectronAPI = {
  selectDownloadPath: () => ipcRenderer.invoke('select-download-folder'),
  downloadVideo: options => ipcRenderer.invoke('download-video', options),
  getVideoInfo: url => ipcRenderer.invoke('get-video-info', url),
  openFolder: folderPath => ipcRenderer.invoke('open-folder', folderPath),
  onDownloadProgress: callback => {
    ipcRenderer.on('download-progress', (_, data) => callback(data));
  },
  onDownloadError: callback => {
    ipcRenderer.on('download-error', (_, error) => callback(error));
  },
  removeAllListeners: channel => {
    ipcRenderer.removeAllListeners(channel);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
