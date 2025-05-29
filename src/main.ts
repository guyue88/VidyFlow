import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  IpcMainInvokeEvent,
} from 'electron';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import squirrelStartup from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (squirrelStartup) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    show: false,
    frame: true,
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open the DevTools.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC 处理程序
ipcMain.handle('select-download-folder', async (): Promise<string | null> => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

interface DownloadOptions {
  url: string;
  outputPath: string;
  quality: string;
}

interface DownloadResult {
  success: boolean;
  output?: string;
  error?: string;
}

ipcMain.handle(
  'download-video',
  async (
    event: IpcMainInvokeEvent,
    options: DownloadOptions
  ): Promise<DownloadResult> => {
    return new Promise(resolve => {
      try {
        // 解析路径，处理 ~ 符号
        const resolvedPath = options.outputPath.startsWith('~')
          ? path.join(os.homedir(), options.outputPath.slice(1))
          : options.outputPath;

        // 改进的格式选择器，确保音视频合并
        let formatSelector =
          'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
        if (options.quality !== 'best') {
          const height = options.quality.replace('p', '');
          // 使用正确的格式选择器，优先选择合并格式
          formatSelector = `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
        }

        console.log('Quality:', options.quality);
        console.log('Format selector:', formatSelector);

        const args = [
          options.url,
          '-o',
          path.join(resolvedPath, 'XDOWN_%(title)s.%(ext)s'),
          '--format',
          formatSelector,
          '--merge-output-format',
          'mp4',
          '--no-playlist',
          '--progress',
          '--newline',
          // 确保ffmpeg可用于合并
          '--prefer-ffmpeg',
          // 如果需要合并，保留临时文件直到合并完成
          // '--keep-video',
        ];

        console.log('yt-dlp args:', args);
        const ytDlp = spawn('yt-dlp', args);

        let output = '';
        let error = '';
        let currentStage = 'preparing';
        let videoCompleted = false;
        let audioCompleted = false;
        let overallProgress = 0;

        ytDlp.stdout.on('data', (data: Buffer) => {
          const dataStr = data.toString();
          output += dataStr;
          console.log('yt-dlp stdout:', dataStr);

          // 解析不同阶段的进度
          const lines = dataStr.split('\n').filter(line => line.trim());

          for (const line of lines) {
            // 检测当前阶段
            if (line.includes('[download] Destination:')) {
              if (line.includes('audio')) {
                currentStage = 'audio';
                console.log('🎵 开始下载音频');
              } else {
                currentStage = 'video';
                console.log('🎬 开始下载视频');
              }
            } else if (
              line.includes('[Merger]') ||
              line.includes('Merging formats')
            ) {
              currentStage = 'merging';
              console.log('🔄 开始合并音视频');
            } else if (line.includes('[ffmpeg]')) {
              currentStage = 'processing';
              console.log('⚙️ 后处理中');
            }

            // 解析进度信息 - 支持多种yt-dlp输出格式
            let progressMatch = null;
            let percentage = 0;
            let totalSize = 0;
            let totalUnit = '';
            let speed = 0;
            let speedUnit = '';
            let eta = '';

            // 格式1: [download]   0.1% of ~  26.99MiB at    8.65KiB/s ETA 20:40 (frag 1/27)
            progressMatch = line.match(
              /\[download\]\s+(\d+\.?\d*)%\s+of\s+~?\s*([\d.]+)(\w+)\s+at\s+([\d.]+)(\w+\/s)\s+ETA\s+(\d+:\d+|Unknown)(?:\s+\(frag\s+\d+\/\d+\))?/
            );

            if (progressMatch) {
              percentage = parseFloat(progressMatch[1]);
              totalSize = parseFloat(progressMatch[2]);
              totalUnit = progressMatch[3];
              speed = parseFloat(progressMatch[4]);
              speedUnit = progressMatch[5];
              eta = progressMatch[6];
            } else {
              // 格式2: [download]  68.4% of    8.04MiB at   41.60KiB/s ETA 01:02
              progressMatch = line.match(
                /\[download\]\s+(\d+\.?\d*)%\s+of\s+([\d.]+)(\w+)\s+at\s+([\d.]+)(\w+\/s)\s+ETA\s+(\d+:\d+|Unknown)/
              );

              if (progressMatch) {
                percentage = parseFloat(progressMatch[1]);
                totalSize = parseFloat(progressMatch[2]);
                totalUnit = progressMatch[3];
                speed = parseFloat(progressMatch[4]);
                speedUnit = progressMatch[5];
                eta = progressMatch[6];
              } else {
                // 格式3: [download] 100% of 4.25MiB in 00:01:37 at 44.75KiB/s
                progressMatch = line.match(
                  /\[download\]\s+100%\s+of\s+([\d.]+)(\w+)\s+in\s+(\d+:\d+:\d+|\d+:\d+)\s+at\s+([\d.]+)(\w+\/s)/
                );

                if (progressMatch) {
                  percentage = 100;
                  totalSize = parseFloat(progressMatch[1]);
                  totalUnit = progressMatch[2];
                  speed = parseFloat(progressMatch[4]);
                  speedUnit = progressMatch[5];
                  eta = '00:00';
                }
              }
            }

            if (progressMatch && percentage !== undefined) {
              // 计算整体进度
              if (currentStage === 'video') {
                // 视频下载占总进度的60%
                overallProgress = (percentage / 100) * 60;
                if (percentage === 100) {
                  videoCompleted = true;
                  console.log('✅ 视频下载完成');
                }
              } else if (currentStage === 'audio') {
                // 音频下载占总进度的30% (60% + 30% = 90%)
                const audioProgress = (percentage / 100) * 30;
                overallProgress = 60 + audioProgress;
                if (percentage === 100) {
                  audioCompleted = true;
                  console.log('✅ 音频下载完成');
                }
              } else if (currentStage === 'merging') {
                // 合并占总进度的10% (90% + 10% = 100%)
                overallProgress = 90 + 10;
                eta = '合并中...';
              }

              // 转换文件大小为字节
              const sizeMultipliers: { [key: string]: number } = {
                B: 1,
                KiB: 1024,
                MiB: 1024 * 1024,
                GiB: 1024 * 1024 * 1024,
                TiB: 1024 * 1024 * 1024 * 1024,
                KB: 1000,
                MB: 1000 * 1000,
                GB: 1000 * 1000 * 1000,
                TB: 1000 * 1000 * 1000 * 1000,
              };

              const totalBytes = totalSize * (sizeMultipliers[totalUnit] || 1);
              const downloadedBytes = Math.round(
                (percentage / 100) * totalBytes
              );

              // 转换速度为字节/秒
              const speedMultipliers: { [key: string]: number } = {
                'B/s': 1,
                'KiB/s': 1024,
                'MiB/s': 1024 * 1024,
                'GiB/s': 1024 * 1024 * 1024,
                'TiB/s': 1024 * 1024 * 1024 * 1024,
                'KB/s': 1000,
                'MB/s': 1000 * 1000,
                'GB/s': 1000 * 1000 * 1000,
                'TB/s': 1000 * 1000 * 1000 * 1000,
              };

              const speedBytesPerSec =
                speed * (speedMultipliers[speedUnit] || 1);

              // 格式化速度显示
              const formatSpeed = (bytesPerSec: number): string => {
                if (bytesPerSec >= 1024 * 1024) {
                  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
                } else if (bytesPerSec >= 1024) {
                  return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
                } else {
                  return `${bytesPerSec.toFixed(0)} B/s`;
                }
              };

              // 获取阶段显示名称
              const getStageDisplayName = (stage: string): string => {
                const stageNames: { [key: string]: string } = {
                  preparing: '准备中',
                  video: '下载视频',
                  audio: '下载音频',
                  merging: '合并文件',
                  processing: '后处理',
                };
                return stageNames[stage] || stage;
              };

              const progressData = {
                raw: line,
                stage: getStageDisplayName(currentStage),
                timestamp: Date.now(),
                downloaded: downloadedBytes,
                total: totalBytes,
                percentage: Math.min(overallProgress, 100), // 使用计算的整体进度
                speed: formatSpeed(speedBytesPerSec),
                eta: currentStage === 'merging' ? '合并中...' : eta,
                completed: overallProgress >= 100,
              };

              console.log('📤 发送整体进度:', {
                stage: currentStage,
                stageProgress: percentage,
                overallProgress: overallProgress.toFixed(1),
                videoCompleted,
                audioCompleted,
              });

              // 发送详细的进度信息
              event.sender.send('download-progress', progressData);
            } else {
              // 处理合并阶段
              if (
                line.includes('[Merger]') &&
                videoCompleted &&
                audioCompleted
              ) {
                const progressData = {
                  raw: line,
                  stage: '合并文件',
                  timestamp: Date.now(),
                  downloaded: 0,
                  total: 0,
                  percentage: 95,
                  speed: '',
                  eta: '合并中...',
                  completed: false,
                };
                event.sender.send('download-progress', progressData);
              }
            }
          }
        });

        ytDlp.stderr.on('data', (data: Buffer) => {
          const errorStr = data.toString();
          error += errorStr;
          console.log('yt-dlp stderr:', errorStr);
          event.sender.send('download-error', errorStr);
        });

        ytDlp.on('close', (code: number) => {
          console.log('yt-dlp exit code:', code);
          if (code === 0) {
            // 发送完成进度
            event.sender.send('download-progress', {
              raw: 'Download completed',
              stage: '下载完成',
              timestamp: Date.now(),
              downloaded: 0,
              total: 0,
              percentage: 100,
              speed: '',
              eta: '00:00',
              completed: true,
            });

            resolve({ success: true, output });
          } else {
            resolve({
              success: false,
              error: error || `Process exited with code ${code}`,
            });
          }
        });

        ytDlp.on('error', (err: Error) => {
          console.error('yt-dlp spawn error:', err);
          resolve({ success: false, error: err.message });
        });
      } catch (err) {
        console.error('download-video handler error:', err);
        resolve({ success: false, error: (err as Error).message });
      }
    });
  }
);

interface VideoInfo {
  title?: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
  formats?: Array<{ height?: number; [key: string]: unknown }>;
}

ipcMain.handle(
  'get-video-info',
  async (
    event: IpcMainInvokeEvent,
    url: string
  ): Promise<VideoInfo | { error: string }> => {
    return new Promise(resolve => {
      try {
        console.log('Getting video info for:', url);
        const ytDlp = spawn('yt-dlp', ['--dump-json', '--no-download', url]);

        let output = '';
        let error = '';

        ytDlp.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });

        ytDlp.stderr.on('data', (data: Buffer) => {
          const errorStr = data.toString();
          error += errorStr;
          console.log('yt-dlp stderr:', errorStr);
        });

        ytDlp.on('close', (code: number) => {
          console.log('yt-dlp info exit code:', code);
          if (code === 0) {
            try {
              const videoInfo = JSON.parse(output);
              console.log('Video info parsed successfully');
              resolve({
                title: videoInfo.title,
                duration: videoInfo.duration,
                thumbnail: videoInfo.thumbnail,
                uploader: videoInfo.uploader,
                formats: videoInfo.formats || [],
              });
            } catch (parseError) {
              console.error('JSON parse error:', parseError);
              resolve({ error: '解析视频信息失败' });
            }
          } else {
            console.error('yt-dlp failed with code:', code, 'error:', error);
            resolve({ error: error || '获取视频信息失败' });
          }
        });

        ytDlp.on('error', (err: Error) => {
          console.error('yt-dlp spawn error:', err);
          resolve({ error: `无法启动yt-dlp: ${err.message}` });
        });
      } catch (err) {
        console.error('get-video-info handler error:', err);
        resolve({ error: (err as Error).message });
      }
    });
  }
);

ipcMain.handle(
  'open-folder',
  async (event: IpcMainInvokeEvent, folderPath: string): Promise<void> => {
    shell.openPath(folderPath);
  }
);

// 获取用户默认下载目录
ipcMain.handle('get-default-download-path', async (): Promise<string> => {
  return path.join(os.homedir(), 'Downloads');
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
