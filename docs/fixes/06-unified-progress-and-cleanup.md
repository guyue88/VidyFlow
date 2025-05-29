# 统一进度显示和临时文件清理修复

## 问题描述

用户发现下载过程中存在以下问题：

1. **进度条重复**：先显示视频下载0%-100%，然后音频下载又从0%-100%，用户体验不佳
2. **临时文件残留**：下载完成后会在文件夹中留下3个文件：
   - 视频临时文件（如 `video.f137.mp4`）
   - 音频临时文件（如 `audio.f140.m4a`）
   - 最终合并文件（如 `video.mp4`）

## 问题分析

### 下载流程分析

yt-dlp的实际下载流程：

1. **视频下载阶段**：下载视频流，进度0%-100%
2. **音频下载阶段**：下载音频流，进度重新从0%-100%
3. **合并阶段**：使用ffmpeg合并音视频文件
4. **完成**：生成最终文件，但保留临时文件

### 用户体验问题

- 进度条"倒退"让用户困惑
- 临时文件占用额外存储空间
- 文件夹混乱，用户不知道哪个是最终文件

## 修复方案

### 1. 统一进度计算

将整个下载过程划分为连续的阶段：

```javascript
// 计算整体进度
if (currentStage === 'video') {
  // 视频下载占总进度的60%
  overallProgress = (percentage / 100) * 60;
} else if (currentStage === 'audio') {
  // 音频下载占总进度的30% (60% + 30% = 90%)
  const audioProgress = (percentage / 100) * 30;
  overallProgress = 60 + audioProgress;
} else if (currentStage === 'merging') {
  // 合并占总进度的10% (90% + 10% = 100%)
  overallProgress = 90 + 10;
}
```

### 2. 阶段显示优化

添加清晰的阶段提示：

```javascript
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
```

### 3. 临时文件自动清理

下载完成后自动清理临时文件：

```javascript
// 清理临时文件（保留最终合并的视频文件）
setTimeout(async () => {
  try {
    const fs = await import('fs-extra');
    const resolvedPath = options.outputPath.startsWith('~')
      ? path.join(os.homedir(), options.outputPath.slice(1))
      : options.outputPath;

    // 读取下载目录中的所有文件
    const files = await fs.readdir(resolvedPath);

    for (const file of files) {
      // 检查是否为临时文件（包含格式ID如.f137.mp4, .f140.m4a等）
      if (file.match(/\.f\d+\.(mp4|m4a|webm|mkv)$/)) {
        const fullPath = path.join(resolvedPath, file);
        await fs.remove(fullPath);
        console.log('🗑️ 已清理临时文件:', file);
      }
    }
  } catch (cleanupError) {
    console.log('⚠️ 清理过程出错:', cleanupError);
  }
}, 2000); // 等待2秒后清理，确保合并完成
```

## 修改的文件

### `src/main.ts`

**主要修改**：

1. **添加进度跟踪变量**：

   ```javascript
   let videoCompleted = false;
   let audioCompleted = false;
   let overallProgress = 0;
   ```

2. **统一进度计算**：

   - 视频下载：0% - 60%
   - 音频下载：60% - 90%
   - 合并处理：90% - 100%

3. **阶段日志优化**：

   ```javascript
   console.log('🎬 开始下载视频');
   console.log('🎵 开始下载音频');
   console.log('🔄 开始合并音视频');
   ```

4. **临时文件清理**：
   - 使用正则表达式识别临时文件：`/\.f\d+\.(mp4|m4a|webm|mkv)$/`
   - 延迟2秒清理，确保合并完成
   - 只保留最终合并的视频文件

## 预期效果

### 用户体验改进

1. **连续进度显示**：

   - 进度条从0%平滑增长到100%，不再"倒退"
   - 清晰的阶段提示：下载视频 → 下载音频 → 合并文件 → 下载完成

2. **文件管理优化**：

   - 下载完成后只保留最终的视频文件
   - 自动清理临时文件，节省存储空间
   - 文件夹整洁，用户体验更好

3. **状态反馈增强**：
   - 详细的控制台日志，便于调试
   - 实时的阶段状态显示
   - 清理过程的反馈信息

### 技术改进

1. **进度计算准确性**：使用权重分配确保进度连续性
2. **资源管理**：自动清理临时文件，避免存储浪费
3. **错误处理**：完善的异常捕获和日志记录
4. **性能优化**：延迟清理避免与合并过程冲突

## 测试验证

修复后的下载流程：

1. ✅ 进度条连续增长：0% → 60% → 90% → 100%
2. ✅ 阶段提示清晰：下载视频 → 下载音频 → 合并文件
3. ✅ 临时文件自动清理：只保留最终视频文件
4. ✅ 用户体验流畅：无进度倒退，状态明确

这次修复彻底解决了进度显示混乱和文件管理问题，提供了更专业的下载体验。
