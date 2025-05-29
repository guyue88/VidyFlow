import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  IpcMainInvokeEvent,
} from 'electron';
import * as path from 'path';
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
    return new Promise((resolve, reject) => {
      try {
        const args = [
          options.url,
          '-o',
          path.join(options.outputPath, '%(title)s.%(ext)s'),
          '--format',
          options.quality || 'best',
        ];

        const ytDlp = spawn('yt-dlp', args);

        let output = '';
        let error = '';

        ytDlp.stdout.on('data', (data: Buffer) => {
          const dataStr = data.toString();
          output += dataStr;
          event.sender.send('download-progress', dataStr);
        });

        ytDlp.stderr.on('data', (data: Buffer) => {
          const errorStr = data.toString();
          error += errorStr;
          event.sender.send('download-error', errorStr);
        });

        ytDlp.on('close', (code: number) => {
          if (code === 0) {
            resolve({ success: true, output });
          } else {
            reject({ success: false, error });
          }
        });
      } catch (err) {
        reject({ success: false, error: (err as Error).message });
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
    return new Promise((resolve, reject) => {
      try {
        const ytDlp = spawn('yt-dlp', ['--dump-json', '--no-download', url]);

        let output = '';
        let error = '';

        ytDlp.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });

        ytDlp.stderr.on('data', (data: Buffer) => {
          error += data.toString();
        });

        ytDlp.on('close', (code: number) => {
          if (code === 0) {
            try {
              const videoInfo = JSON.parse(output);
              resolve({
                title: videoInfo.title,
                duration: videoInfo.duration,
                thumbnail: videoInfo.thumbnail,
                uploader: videoInfo.uploader,
                formats: videoInfo.formats || [],
              });
            } catch {
              reject({ error: '解析视频信息失败' });
            }
          } else {
            reject({ error: error || '获取视频信息失败' });
          }
        });
      } catch (err) {
        reject({ error: (err as Error).message });
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
