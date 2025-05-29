# 进度显示和音视频合并修复

## 🐛 发现的问题

### 1. 进度不显示

**问题**: 控制台有进度输出，但UI界面不显示进度
**原因**:

- 进度解析正则表达式不匹配yt-dlp的实际输出格式
- yt-dlp输出格式: `数字/数字 at 速度 ETA 时间`
- 我们的解析器期望的格式不正确

### 2. 音视频分离

**问题**: 下载的视频分为两个文件，音频和视频分离
**原因**:

- 格式选择器不正确
- 没有正确使用ffmpeg合并参数

## ✅ 修复方案

### 1. 修复进度解析

**主进程修改 (src/main.ts)**:

```typescript
// 正确解析yt-dlp输出格式
const progressMatch = line.match(
  /(\d+)\/(\d+|NA)\s+at\s+([\d.]+)\s+ETA\s+([\d.]+|NA)/
);
if (progressMatch) {
  const downloaded = parseInt(progressMatch[1]);
  const total = progressMatch[2] === 'NA' ? 0 : parseInt(progressMatch[2]);
  const speed = parseFloat(progressMatch[3]);
  const eta = progressMatch[4];

  // 发送解析后的数据到渲染进程
  event.sender.send('download-progress', {
    raw: line,
    stage: currentStage,
    timestamp: Date.now(),
    downloaded,
    total,
    speed: `${(speed / 1024).toFixed(1)} KB/s`,
    eta: eta === 'NA' ? '计算中...' : `${eta}s`,
  });
}
```

**渲染进程修改 (src/App.tsx)**:

```typescript
// 处理主进程解析后的数据
const parseProgressData = (progressData: {
  raw: string;
  stage: string;
  timestamp: number;
  downloaded?: number;
  total?: number;
  speed?: string;
  eta?: string;
}) => {
  // 直接使用解析后的数据
  if (downloaded !== undefined && total !== undefined) {
    newProgress.downloaded = downloaded;
    newProgress.total = total;
    // 计算进度...
  }
};
```

### 2. 修复音视频合并

**格式选择器优化**:

```typescript
// 优先选择合并格式，多重后备方案
let formatSelector = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
if (options.quality !== 'best') {
  const height = options.quality.replace('p', '');
  formatSelector = `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
}
```

**yt-dlp参数优化**:

```typescript
const args = [
  options.url,
  '-o',
  path.join(resolvedPath, '%(title)s.%(ext)s'),
  '--format',
  formatSelector,
  '--merge-output-format',
  'mp4', // 强制输出mp4格式
  '--no-playlist',
  '--progress',
  '--newline',
  '--prefer-ffmpeg', // 优先使用ffmpeg
  '--keep-video', // 保留临时文件直到合并完成
];
```

### 3. 阶段检测改进

```typescript
// 更准确的阶段检测
if (line.includes('[download] Destination:')) {
  if (line.includes('audio')) {
    currentStage = 'audio';
  } else {
    currentStage = 'video';
  }
} else if (line.includes('[Merger]') || line.includes('Merging formats')) {
  currentStage = 'merging';
} else if (line.includes('[ffmpeg]')) {
  currentStage = 'processing';
}
```

## 🎯 格式选择器说明

### 格式选择器优先级

1. `bestvideo[ext=mp4]+bestaudio[ext=m4a]` - 最佳mp4视频+m4a音频，自动合并
2. `best[ext=mp4]` - 最佳已合并的mp4文件
3. `best` - 最佳可用格式（后备方案）

### 质量限制格式选择器

1. `bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]` - 720p以下mp4+音频
2. `bestvideo[height<=720]+bestaudio` - 720p以下视频+任意音频
3. `best[height<=720]` - 720p以下最佳格式

## 🔧 技术细节

### 进度计算权重调整

```typescript
const stageWeights = {
  preparing: 5, // 准备阶段
  video: 45, // 视频下载（主要部分）
  audio: 35, // 音频下载
  merging: 10, // 合并阶段
  processing: 5, // 后处理
};
```

### 文件大小显示

- 直接使用yt-dlp输出的字节数
- 智能格式化显示 (B, KB, MB, GB)
- 实时更新下载进度

## 🚀 预期效果

修复后应该实现：

1. ✅ 实时显示下载进度和文件大小
2. ✅ 正确的阶段标识（视频→音频→合并→完成）
3. ✅ 单个合并的mp4文件输出
4. ✅ 准确的速度和ETA显示
5. ✅ 流畅的进度条动画，无倒退

## 🧪 测试方法

1. 启动应用：`yarn start`
2. 输入视频链接并获取信息
3. 开始下载，观察：
   - 进度条是否实时更新
   - 文件大小是否正确显示
   - 阶段标签是否正确切换
   - 最终是否只生成一个mp4文件

如果仍有问题，可以检查控制台输出的yt-dlp日志来诊断具体问题。
