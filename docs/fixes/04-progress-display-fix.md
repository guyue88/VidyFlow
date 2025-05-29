# 进度显示修复 - 第二轮

## 🐛 问题描述

用户报告虽然控制台有进度输出，但界面上未显示这些信息。通过分析日志发现：

### 实际 yt-dlp 输出格式

```
[download]  61.6% of    4.25MiB at   44.03KiB/s ETA 00:38
[download]  62.7% of    4.25MiB at   43.79KiB/s ETA 00:37
[download] 100% of    4.25MiB in 00:01:37 at 44.75KiB/s
```

### 之前的正则表达式

```typescript
// 错误的格式匹配
const progressMatch = line.match(
  /(\d+)\/(\d+|NA)\s+at\s+([\d.]+)\s+ETA\s+([\d.]+|NA)/
);
```

这个正则表达式期望的是 `数字/数字 at 速度 ETA 时间` 格式，但实际输出是百分比格式。

## ✅ 解决方案

### 1. 修复主进程进度解析 (src/main.ts)

```typescript
// 正确匹配 yt-dlp 的实际输出格式
const progressMatch = line.match(
  /\[download\]\s+(\d+\.?\d*)%\s+of\s+([\d.]+)(\w+)\s+at\s+([\d.]+)(\w+\/s)\s+ETA\s+(\d+:\d+)/
);

if (progressMatch) {
  const percentage = parseFloat(progressMatch[1]);
  const totalSize = parseFloat(progressMatch[2]);
  const totalUnit = progressMatch[3];
  const speed = parseFloat(progressMatch[4]);
  const speedUnit = progressMatch[5];
  const eta = progressMatch[6];

  // 转换文件大小为字节
  const sizeMultipliers: { [key: string]: number } = {
    B: 1,
    KiB: 1024,
    MiB: 1024 * 1024,
    GiB: 1024 * 1024 * 1024,
    KB: 1000,
    MB: 1000 * 1000,
    GB: 1000 * 1000 * 1000,
  };

  const totalBytes = totalSize * (sizeMultipliers[totalUnit] || 1);
  const downloadedBytes = Math.round((percentage / 100) * totalBytes);

  // 转换速度为字节/秒
  const speedMultipliers: { [key: string]: number } = {
    'B/s': 1,
    'KiB/s': 1024,
    'MiB/s': 1024 * 1024,
    'GiB/s': 1024 * 1024 * 1024,
    'KB/s': 1000,
    'MB/s': 1000 * 1000,
    'GB/s': 1000 * 1000 * 1000,
  };

  const speedBytesPerSec = speed * (speedMultipliers[speedUnit] || 1);

  // 发送详细的进度信息
  event.sender.send('download-progress', {
    raw: line,
    stage: currentStage,
    timestamp: Date.now(),
    downloaded: downloadedBytes,
    total: totalBytes,
    percentage: percentage,
    speed: `${(speedBytesPerSec / 1024).toFixed(1)} KB/s`,
    eta: eta,
  });
}
```

### 2. 添加完成状态检测

```typescript
// 匹配完成信息: [download] 100% of 4.25MiB in 00:01:37 at 44.75KiB/s
const completeMatch = line.match(
  /\[download\]\s+100%\s+of\s+([\d.]+)(\w+)\s+in\s+(\d+:\d+:\d+|\d+:\d+)\s+at\s+([\d.]+)(\w+\/s)/
);

if (completeMatch) {
  const totalSize = parseFloat(completeMatch[1]);
  const totalUnit = completeMatch[2];
  const duration = completeMatch[3];
  const avgSpeed = parseFloat(completeMatch[4]);
  const speedUnit = completeMatch[5];

  const totalBytes = totalSize * (sizeMultipliers[totalUnit] || 1);

  event.sender.send('download-progress', {
    raw: line,
    stage: currentStage,
    timestamp: Date.now(),
    downloaded: totalBytes,
    total: totalBytes,
    percentage: 100,
    speed: `${avgSpeed} ${speedUnit}`,
    eta: '00:00',
    completed: true,
  });
}
```

### 3. 更新渲染进程处理逻辑 (src/App.tsx)

```typescript
const parseProgressData = (progressData: {
  raw: string;
  stage: string;
  timestamp: number;
  downloaded?: number;
  total?: number;
  percentage?: number;
  speed?: string;
  eta?: string;
  completed?: boolean;
}) => {
  const { raw, stage, downloaded, total, percentage, speed, eta, completed } =
    progressData;

  setDownloadProgress(prev => {
    if (!prev) return null;

    const newProgress = { ...prev };
    newProgress.stage = stage;

    // 如果主进程已经解析了数据，直接使用
    if (downloaded !== undefined && total !== undefined) {
      newProgress.downloaded = downloaded;
      newProgress.total = total;

      // 使用百分比或计算百分比
      const currentPercentage =
        percentage !== undefined
          ? percentage
          : total > 0
            ? (downloaded / total) * 100
            : 0;

      // 更新阶段进度
      newProgress.stageProgress[stage] = currentPercentage;

      // 如果是单文件下载（没有音视频分离），直接使用百分比
      if (stage === 'video' && !raw.includes('audio')) {
        newProgress.progress = currentPercentage;
      } else {
        // 计算总体进度（多阶段下载）
        // ... 阶段权重计算逻辑
      }
    }

    // 更新速度和ETA
    if (speed) {
      newProgress.speed = speed;
    }
    if (eta) {
      newProgress.eta = eta;
    }

    // 如果下载完成
    if (completed) {
      newProgress.progress = 100;
      newProgress.eta = '00:00';
    }

    return newProgress;
  });
};
```

## 🔍 关键改进点

### 1. 正确的正则表达式

- **之前**: 匹配 `数字/数字` 格式
- **现在**: 匹配 `百分比 of 大小` 格式

### 2. 单位转换支持

- 支持 `B`, `KiB`, `MiB`, `GiB` 等二进制单位
- 支持 `KB`, `MB`, `GB` 等十进制单位
- 正确转换速度单位

### 3. 智能进度计算

- 单文件下载：直接使用百分比
- 多阶段下载：基于权重计算总体进度
- 完成状态检测：确保进度达到 100%

### 4. 数据结构优化

- 添加 `percentage` 字段直接传递百分比
- 添加 `completed` 字段标识完成状态
- 保留原始数据用于调试

## 🧪 测试验证

### 预期效果

1. ✅ 实时显示下载百分比
2. ✅ 正确显示文件大小（已下载/总大小）
3. ✅ 实时更新下载速度
4. ✅ 准确显示剩余时间
5. ✅ 进度条流畅更新，无倒退

### 测试方法

1. 启动应用：`yarn start`
2. 输入视频链接并获取信息
3. 开始下载，观察进度显示
4. 检查控制台日志确认数据解析正确

## 📊 数据流程

```
yt-dlp 输出 → 主进程解析 → IPC 通信 → 渲染进程处理 → UI 更新
     ↓              ↓            ↓            ↓           ↓
实际格式      正则匹配     结构化数据    状态更新     进度条
```

## 🚀 后续优化

1. **错误处理**: 添加解析失败的降级处理
2. **性能优化**: 限制进度更新频率，避免过度渲染
3. **用户体验**: 添加更多视觉反馈和动画效果

---

**修复状态**: ✅ 已完成  
**测试状态**: 🧪 待验证  
**最后更新**: 2025-05-29
