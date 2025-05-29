// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// 暴露API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件夹选择
  selectDownloadFolder: () => ipcRenderer.invoke('select-download-folder'),

  // 视频下载
  downloadVideo: (options: {
    url: string;
    outputPath: string;
    quality: string;
  }) => ipcRenderer.invoke('download-video', options),
  getVideoInfo: (url: string) => ipcRenderer.invoke('get-video-info', url),

  // 文件操作
  openFolder: (path: string) => ipcRenderer.invoke('open-folder', path),
  getDefaultDownloadPath: () => ipcRenderer.invoke('get-default-download-path'),

  // 依赖管理
  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),
  installDependencies: () => ipcRenderer.invoke('install-dependencies'),

  // 事件监听
  onDownloadProgress: (callback: (data: unknown) => void) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },
  onDownloadError: (callback: (error: string) => void) => {
    ipcRenderer.on('download-error', (event, error) => callback(error));
  },
  onDependencyInstallProgress: (
    callback: (data: { dependency: string; progress: number }) => void
  ) => {
    ipcRenderer.on('dependency-install-progress', (event, data) =>
      callback(data)
    );
  },

  // 移除事件监听器
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
