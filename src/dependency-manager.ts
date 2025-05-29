import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { spawn, exec } from 'child_process';
import { app } from 'electron';

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

export class DependencyManager {
  private appDataPath: string;
  private binPath: string;

  constructor() {
    // 获取应用数据目录
    this.appDataPath = path.join(app.getPath('userData'), 'dependencies');
    this.binPath = path.join(this.appDataPath, 'bin');
  }

  /**
   * 初始化依赖目录
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(this.appDataPath);
    await fs.ensureDir(this.binPath);
  }

  /**
   * 检查依赖状态
   */
  async checkDependencies(): Promise<DependencyStatus> {
    const status: DependencyStatus = {
      ytDlp: { installed: false },
      ffmpeg: { installed: false },
    };

    // 检查yt-dlp
    try {
      const ytDlpPath = await this.getYtDlpPath();
      const ytDlpVersion = await this.getVersion(ytDlpPath, '--version');
      status.ytDlp = {
        installed: true,
        version: ytDlpVersion,
        path: ytDlpPath,
      };
    } catch (error) {
      console.log('yt-dlp not found:', error);
    }

    // 检查ffmpeg
    try {
      const ffmpegPath = await this.getFfmpegPath();
      const ffmpegVersion = await this.getVersion(ffmpegPath, '-version');
      status.ffmpeg = {
        installed: true,
        version: ffmpegVersion,
        path: ffmpegPath,
      };
    } catch (error) {
      console.log('ffmpeg not found:', error);
    }

    return status;
  }

  /**
   * 获取yt-dlp路径
   */
  async getYtDlpPath(): Promise<string> {
    const platform = os.platform();
    const localPath = path.join(
      this.binPath,
      platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
    );

    // 优先使用本地版本
    if (await fs.pathExists(localPath)) {
      return localPath;
    }

    // 检查系统PATH中的版本
    return new Promise((resolve, reject) => {
      const command = platform === 'win32' ? 'where yt-dlp' : 'which yt-dlp';
      exec(command, (error, stdout) => {
        if (error) {
          reject(new Error('yt-dlp not found in system PATH'));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * 获取ffmpeg路径
   */
  async getFfmpegPath(): Promise<string> {
    const platform = os.platform();
    const localPath = path.join(
      this.binPath,
      platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    );

    // 优先使用本地版本
    if (await fs.pathExists(localPath)) {
      return localPath;
    }

    // 检查系统PATH中的版本
    return new Promise((resolve, reject) => {
      const command = platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
      exec(command, (error, stdout) => {
        if (error) {
          reject(new Error('ffmpeg not found in system PATH'));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * 获取程序版本
   */
  private getVersion(execPath: string, versionFlag: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(execPath, [versionFlag]);
      let output = '';

      child.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        output += data.toString();
      });

      child.on('close', (code: number) => {
        if (code === 0) {
          // 提取版本号
          const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
          resolve(versionMatch ? versionMatch[1] : 'unknown');
        } else {
          reject(new Error(`Failed to get version: ${output}`));
        }
      });

      child.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * 下载yt-dlp
   */
  async downloadYtDlp(onProgress?: (progress: number) => void): Promise<void> {
    const platform = os.platform();
    const arch = os.arch();

    let downloadUrl: string;
    let fileName: string;

    // 根据平台确定下载URL
    if (platform === 'win32') {
      fileName = 'yt-dlp.exe';
      downloadUrl =
        'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
    } else if (platform === 'darwin') {
      fileName = 'yt-dlp';
      if (arch === 'arm64') {
        downloadUrl =
          'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
      } else {
        downloadUrl =
          'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
      }
    } else {
      fileName = 'yt-dlp';
      downloadUrl =
        'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
    }

    const filePath = path.join(this.binPath, fileName);
    await this.downloadFile(downloadUrl, filePath, onProgress);

    // 设置执行权限（Unix系统）
    if (platform !== 'win32') {
      await fs.chmod(filePath, '755');
    }

    console.log('✅ yt-dlp下载完成:', filePath);
  }

  /**
   * 下载ffmpeg
   */
  async downloadFfmpeg(onProgress?: (progress: number) => void): Promise<void> {
    const platform = os.platform();

    if (platform === 'win32') {
      await this.downloadFfmpegWindows(onProgress);
    } else if (platform === 'darwin') {
      await this.downloadFfmpegMacOS(onProgress);
    } else {
      await this.downloadFfmpegLinux(onProgress);
    }
  }

  /**
   * 下载Windows版ffmpeg
   */
  private async downloadFfmpegWindows(
    onProgress?: (progress: number) => void
  ): Promise<void> {
    // Windows版本需要下载压缩包并解压
    const downloadUrl =
      'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
    const zipPath = path.join(this.appDataPath, 'ffmpeg.zip');

    await this.downloadFile(downloadUrl, zipPath, onProgress);

    // 解压并移动ffmpeg.exe到bin目录
    // 这里需要添加解压逻辑
    console.log('✅ ffmpeg下载完成（Windows）');
  }

  /**
   * 下载macOS版ffmpeg
   */
  private async downloadFfmpegMacOS(
    onProgress?: (progress: number) => void
  ): Promise<void> {
    // macOS可以使用静态构建版本
    const downloadUrl = 'https://evermeet.cx/ffmpeg/getrelease/zip';
    const zipPath = path.join(this.appDataPath, 'ffmpeg.zip');

    await this.downloadFile(downloadUrl, zipPath, onProgress);

    // 解压并移动ffmpeg到bin目录
    console.log('✅ ffmpeg下载完成（macOS）');
  }

  /**
   * 下载Linux版ffmpeg
   */
  private async downloadFfmpegLinux(
    onProgress?: (progress: number) => void
  ): Promise<void> {
    // Linux版本使用静态构建
    const downloadUrl =
      'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz';
    const tarPath = path.join(this.appDataPath, 'ffmpeg.tar.xz');

    await this.downloadFile(downloadUrl, tarPath, onProgress);

    // 解压并移动ffmpeg到bin目录
    console.log('✅ ffmpeg下载完成（Linux）');
  }

  /**
   * 下载文件
   */
  private async downloadFile(
    url: string,
    filePath: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      import('https').then(https => {
        const file = fs.createWriteStream(filePath);

        https.default.get(
          url,
          (response: {
            statusCode?: number;
            statusMessage?: string;
            headers: { [key: string]: string | string[] | undefined };
            on: (event: string, callback: (chunk: Buffer) => void) => void;
            pipe: (destination: NodeJS.WritableStream) => void;
          }) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
              // 处理重定向
              const location = response.headers.location;
              const redirectUrl = Array.isArray(location)
                ? location[0]
                : location;
              if (redirectUrl) {
                return this.downloadFile(redirectUrl, filePath, onProgress)
                  .then(resolve)
                  .catch(reject);
              }
            }

            if (response.statusCode !== 200) {
              reject(
                new Error(
                  `HTTP ${response.statusCode}: ${response.statusMessage}`
                )
              );
              return;
            }

            const contentLength = response.headers['content-length'];
            const totalSize = parseInt(
              Array.isArray(contentLength)
                ? contentLength[0] || '0'
                : contentLength || '0',
              10
            );
            let downloadedSize = 0;

            response.on('data', (chunk: Buffer) => {
              downloadedSize += chunk.length;
              if (onProgress && totalSize > 0) {
                const progress = (downloadedSize / totalSize) * 100;
                onProgress(Math.round(progress));
              }
            });

            response.pipe(file);

            file.on('finish', () => {
              file.close();
              resolve();
            });

            file.on('error', (error: Error) => {
              fs.unlink(filePath).catch(() => {}); // 删除部分下载的文件
              reject(error);
            });
          }
        );
      });
    });
  }

  /**
   * 安装所有缺失的依赖
   */
  async installMissingDependencies(
    onProgress?: (dependency: string, progress: number) => void
  ): Promise<void> {
    await this.initialize();
    const status = await this.checkDependencies();

    if (!status.ytDlp.installed) {
      console.log('📥 开始下载yt-dlp...');
      await this.downloadYtDlp(progress => {
        onProgress?.('yt-dlp', progress);
      });
    }

    if (!status.ffmpeg.installed) {
      console.log('📥 开始下载ffmpeg...');
      await this.downloadFfmpeg(progress => {
        onProgress?.('ffmpeg', progress);
      });
    }
  }
}

// 导出单例实例
export const dependencyManager = new DependencyManager();
