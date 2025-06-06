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
   * 检查文件是否为有效的可执行文件
   */
  private async validateExecutableFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);

      // 检查文件大小，太小的文件可能是损坏的
      if (stats.size < 1024) {
        console.log('❌ 文件太小，可能损坏:', filePath, '大小:', stats.size);
        return false;
      }

      // 读取文件前几个字节检查文件头
      const buffer = await fs.readFile(filePath, { flag: 'r' });

      // 检查是否是有效的可执行文件（基本的文件头检查）
      const platform = os.platform();
      if (platform === 'darwin' || platform === 'linux') {
        // Unix可执行文件通常以 #! 开头，或者是二进制文件
        const header = buffer.toString('ascii', 0, 2);
        const isScript = header === '#!';
        const isBinary = buffer[0] === 0x7f && buffer[1] === 0x45; // ELF magic
        const isMachO = buffer[0] === 0xfe && buffer[1] === 0xed; // Mach-O magic (little endian)
        const isMachOBig = buffer[0] === 0xce && buffer[1] === 0xfa; // Mach-O magic (big endian)

        if (!isScript && !isBinary && !isMachO && !isMachOBig) {
          console.log('❌ 不是有效的可执行文件格式:', filePath);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.log('❌ 文件验证失败:', error);
      return false;
    }
  }

  /**
   * 检查并修复文件权限
   */
  private async ensureExecutablePermission(filePath: string): Promise<void> {
    const platform = os.platform();
    if (platform === 'win32') return; // Windows不需要设置执行权限

    // 首先验证文件完整性
    const isValid = await this.validateExecutableFile(filePath);
    if (!isValid) {
      console.log('🗑️ 删除损坏的文件:', filePath);
      await fs.unlink(filePath);
      throw new Error('文件损坏，需要重新下载');
    }

    try {
      const stats = await fs.stat(filePath);
      // 检查文件是否有执行权限（至少用户有执行权限）
      if (!(stats.mode & 0o100)) {
        console.log('🔧 修复文件执行权限:', filePath);
        await fs.chmod(filePath, '755');
      }
    } catch (error) {
      console.warn('检查文件权限失败:', error);
      // 尝试设置权限
      try {
        await fs.chmod(filePath, '755');
      } catch (chmodError) {
        throw new Error(`无法设置文件执行权限: ${chmodError}`);
      }
    }
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
      // 如果是文件损坏的错误，自动重新下载
      if (
        error instanceof Error &&
        error.message.includes('文件损坏，需要重新下载')
      ) {
        console.log('🔄 检测到文件损坏，开始重新下载yt-dlp...');
        try {
          await this.downloadYtDlp();
          console.log('✅ 重新下载完成，重新检查yt-dlp');
          // 重新检查
          const ytDlpPath = await this.getYtDlpPath();
          const ytDlpVersion = await this.getVersion(ytDlpPath, '--version');
          status.ytDlp = {
            installed: true,
            version: ytDlpVersion,
            path: ytDlpPath,
          };
        } catch (redownloadError) {
          console.error('❌ 重新下载失败:', redownloadError);
        }
      }
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
      // 如果是文件损坏的错误，自动重新下载
      if (
        error instanceof Error &&
        error.message.includes('文件损坏，需要重新下载')
      ) {
        console.log('🔄 检测到文件损坏，开始重新下载ffmpeg...');
        try {
          await this.downloadFfmpeg();
          console.log('✅ 重新下载完成，重新检查ffmpeg');
          // 重新检查
          const ffmpegPath = await this.getFfmpegPath();
          const ffmpegVersion = await this.getVersion(ffmpegPath, '-version');
          status.ffmpeg = {
            installed: true,
            version: ffmpegVersion,
            path: ffmpegPath,
          };
        } catch (redownloadError) {
          console.error('❌ 重新下载失败:', redownloadError);
        }
      }
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
      try {
        // 确保文件有执行权限
        await this.ensureExecutablePermission(localPath);
        return localPath;
      } catch (error) {
        console.log('❌ 本地yt-dlp文件损坏:', error);
        // 文件损坏，需要重新下载，但这里只是获取路径，不负责下载
        // 抛出特定错误让调用方处理
        throw new Error(`本地yt-dlp文件损坏，需要重新下载: ${error}`);
      }
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
      try {
        // 确保文件有执行权限
        await this.ensureExecutablePermission(localPath);
        return localPath;
      } catch (error) {
        console.log('❌ 本地ffmpeg文件损坏:', error);
        // 文件损坏，需要重新下载，但这里只是获取路径，不负责下载
        // 抛出特定错误让调用方处理
        throw new Error(`本地ffmpeg文件损坏，需要重新下载: ${error}`);
      }
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
      try {
        await fs.chmod(filePath, '755');
        console.log('✅ yt-dlp权限设置完成:', filePath);
      } catch (error) {
        console.error('❌ 设置yt-dlp执行权限失败:', error);
        throw new Error(`无法设置yt-dlp执行权限: ${error}`);
      }
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
