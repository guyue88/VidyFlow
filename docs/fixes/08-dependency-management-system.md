# 依赖管理系统实现

## 问题背景

用户提出了一个重要问题：当将VidyFlow项目打包成可执行文件分发给其他用户时，用户的机器可能缺少yt-dlp和ffmpeg这两个关键依赖，导致应用无法正常工作。

## 解决方案

实现了一个完整的依赖管理系统，包括：

1. **依赖检测**：自动检测系统中是否已安装yt-dlp和ffmpeg
2. **自动下载**：如果依赖缺失，提供一键自动下载安装功能
3. **本地管理**：将依赖下载到应用数据目录，不影响系统环境
4. **用户界面**：提供友好的依赖检查和安装界面

## 技术实现

### 1. 依赖管理器 (`src/dependency-manager.ts`)

**核心功能**：

```typescript
export class DependencyManager {
  private appDataPath: string;
  private binPath: string;

  constructor() {
    // 使用Electron的userData目录存储依赖
    this.appDataPath = path.join(app.getPath('userData'), 'dependencies');
    this.binPath = path.join(this.appDataPath, 'bin');
  }

  // 检查依赖状态
  async checkDependencies(): Promise<DependencyStatus>;

  // 获取可执行文件路径（优先使用本地版本）
  async getYtDlpPath(): Promise<string>;
  async getFfmpegPath(): Promise<string>;

  // 下载依赖
  async downloadYtDlp(onProgress?: (progress: number) => void): Promise<void>;
  async downloadFfmpeg(onProgress?: (progress: number) => void): Promise<void>;

  // 一键安装所有缺失依赖
  async installMissingDependencies(): Promise<void>;
}
```

**路径优先级**：

1. 应用本地目录：`~/.config/VidyFlow/dependencies/bin/`
2. 系统PATH：`which yt-dlp` / `where yt-dlp`

**跨平台支持**：

- **Windows**: 下载.exe文件
- **macOS**: 下载macOS专用版本，支持Intel和Apple Silicon
- **Linux**: 下载Linux静态构建版本

### 2. 依赖检查组件 (`src/components/DependencyChecker.tsx`)

**用户界面特性**：

```typescript
export const DependencyChecker: React.FC<DependencyCheckerProps> = ({
  onDependenciesReady,
}) => {
  // 状态管理
  const [status, setStatus] = useState<DependencyStatus | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<{
    [key: string]: number;
  }>({});
  const [error, setError] = useState<string | null>(null);

  // 功能实现
  const checkDependencies = async () => {
    /* 检查依赖状态 */
  };
  const installDependencies = async () => {
    /* 一键安装 */
  };
};
```

**界面功能**：

- ✅ 实时显示每个依赖的安装状态和版本
- ✅ 一键自动安装缺失的依赖
- ✅ 实时显示下载进度条
- ✅ 错误处理和重试机制
- ✅ 安装完成后自动进入主界面

### 3. 主进程集成 (`src/main.ts`)

**IPC处理程序**：

```typescript
// 依赖检测
ipcMain.handle('check-dependencies', async (): Promise<DependencyStatus> => {
  return await dependencyManager.checkDependencies();
});

// 依赖安装
ipcMain.handle('install-dependencies', async (event: IpcMainInvokeEvent) => {
  await dependencyManager.installMissingDependencies((dependency, progress) => {
    event.sender.send('dependency-install-progress', { dependency, progress });
  });
});

// 视频下载（使用依赖管理器获取路径）
ipcMain.handle('download-video', async (event, options) => {
  const status = await dependencyManager.checkDependencies();
  if (!status.ytDlp.installed) {
    return { success: false, error: 'yt-dlp未安装，请先安装依赖' };
  }

  const ytDlpPath = await dependencyManager.getYtDlpPath();
  const ytDlp = spawn(ytDlpPath, args);
  // ...
});
```

### 4. 应用流程集成 (`src/App.tsx`)

**条件渲染**：

```typescript
const App: React.FC = () => {
  const [dependenciesReady, setDependenciesReady] = useState(false);

  // 如果依赖未就绪，显示依赖检查器
  if (!dependenciesReady) {
    return (
      <DependencyChecker
        onDependenciesReady={() => setDependenciesReady(true)}
      />
    );
  }

  // 依赖就绪后显示主界面
  return <MainInterface />;
};
```

## 用户体验流程

### 首次启动流程

1. **启动应用** → 自动检测依赖
2. **依赖缺失** → 显示依赖检查界面
3. **点击安装** → 自动下载yt-dlp和ffmpeg
4. **显示进度** → 实时进度条和状态更新
5. **安装完成** → 自动进入主界面
6. **正常使用** → 所有功能可用

### 后续启动流程

1. **启动应用** → 检测到依赖已安装
2. **直接进入** → 主界面，无需等待

## 技术优势

### 1. 用户友好

- ✅ **零配置**：用户无需手动安装任何依赖
- ✅ **一键解决**：点击按钮即可自动安装所有依赖
- ✅ **进度可视**：实时显示下载进度和状态
- ✅ **错误处理**：友好的错误提示和重试机制

### 2. 技术可靠

- ✅ **路径优先级**：优先使用本地版本，回退到系统版本
- ✅ **跨平台支持**：Windows、macOS、Linux全平台支持
- ✅ **版本检测**：自动检测和显示依赖版本信息
- ✅ **安全隔离**：依赖安装在应用目录，不影响系统环境

### 3. 开发维护

- ✅ **模块化设计**：依赖管理逻辑独立封装
- ✅ **类型安全**：完整的TypeScript类型定义
- ✅ **错误处理**：完善的异常捕获和处理机制
- ✅ **可扩展性**：易于添加新的依赖管理功能

## 文件结构

```
src/
├── dependency-manager.ts      # 依赖管理核心逻辑
├── components/
│   └── DependencyChecker.tsx  # 依赖检查UI组件
├── main.ts                    # 主进程集成
├── preload.ts                 # API暴露
├── global.d.ts                # 类型定义
└── App.tsx                    # 应用流程集成
```

## 依赖下载源

### yt-dlp

- **Windows**: `https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe`
- **macOS**: `https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos`
- **Linux**: `https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp`

### ffmpeg

- **Windows**: `https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip`
- **macOS**: `https://evermeet.cx/ffmpeg/getrelease/zip`
- **Linux**: `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz`

## 存储位置

依赖文件存储在Electron的userData目录下：

- **Windows**: `%APPDATA%/VidyFlow/dependencies/bin/`
- **macOS**: `~/Library/Application Support/VidyFlow/dependencies/bin/`
- **Linux**: `~/.config/VidyFlow/dependencies/bin/`

## 测试验证

### 功能测试

1. ✅ 首次启动时正确检测依赖缺失
2. ✅ 自动下载功能正常工作
3. ✅ 下载进度正确显示
4. ✅ 安装完成后应用正常工作
5. ✅ 后续启动时直接进入主界面

### 错误处理测试

1. ✅ 网络连接失败时的错误提示
2. ✅ 下载中断时的重试机制
3. ✅ 权限不足时的错误处理
4. ✅ 磁盘空间不足时的提示

## 总结

这个依赖管理系统完美解决了用户提出的问题：

1. **解决了分发问题**：用户无需预先安装任何依赖
2. **提升了用户体验**：一键安装，自动化程度高
3. **保证了应用稳定性**：可靠的依赖检测和管理机制
4. **支持了跨平台部署**：Windows、macOS、Linux全支持

现在VidyFlow可以作为独立的可执行文件分发，用户首次运行时会自动处理所有依赖问题，真正实现了"开箱即用"的体验。
