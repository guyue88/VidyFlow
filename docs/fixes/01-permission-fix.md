# 下载权限问题修复

## 🐛 问题描述

**错误信息**:

```
ERROR: unable to create directory [Errno 13] Permission denied: '/Users/Downloads'
```

**原因分析**:

1. 默认路径 `/Users/Downloads` 不正确（应该是 `/Users/用户名/Downloads`）
2. macOS权限限制，无法在系统级目录创建文件
3. 路径解析问题，没有正确处理用户目录

## ✅ 修复方案

### 1. 修复默认下载路径

```typescript
// 之前：硬编码错误路径
const [downloadPath, setDownloadPath] = useState('/Users/Downloads');

// 修复后：使用用户真实目录
const [downloadPath, setDownloadPath] = useState('~/Downloads');
```

### 2. 添加路径解析功能

在主进程中添加路径解析逻辑：

```typescript
// 解析路径，处理 ~ 符号
const resolvedPath = options.outputPath.startsWith('~')
  ? path.join(os.homedir(), options.outputPath.slice(1))
  : options.outputPath;
```

### 3. 添加获取默认下载目录API

```typescript
// 主进程
ipcMain.handle('get-default-download-path', async (): Promise<string> => {
  return path.join(os.homedir(), 'Downloads');
});

// 渲染进程
useEffect(() => {
  const initializeDownloadPath = async () => {
    try {
      const defaultPath = await window.electronAPI.getDefaultDownloadPath();
      setDownloadPath(defaultPath);
    } catch (error) {
      console.error('获取默认下载路径失败:', error);
    }
  };

  initializeDownloadPath();
}, []);
```

### 4. 增强错误处理和日志

```typescript
// 添加详细的控制台日志
console.log('yt-dlp args:', args);
console.log('yt-dlp stdout:', dataStr);
console.log('yt-dlp stderr:', errorStr);
console.log('yt-dlp exit code:', code);

// 改进错误处理
ytDlp.on('error', (err: Error) => {
  console.error('yt-dlp spawn error:', err);
  resolve({ success: false, error: err.message });
});
```

## 🔧 技术实现

### 主进程修改 (src/main.ts)

1. ✅ 添加 `import * as os from 'os'`
2. ✅ 路径解析逻辑处理 `~` 符号
3. ✅ 新增 `get-default-download-path` IPC处理程序
4. ✅ 增强错误处理和日志记录
5. ✅ 修复ESLint错误（移除未使用参数，使用import代替require）

### 渲染进程修改 (src/App.tsx)

1. ✅ 修改默认下载路径为 `~/Downloads`
2. ✅ 添加初始化下载路径的useEffect
3. ✅ 使用新的API获取用户真实下载目录

### 类型定义更新

1. ✅ 更新 `src/preload.ts` 添加新API
2. ✅ 更新 `src/global.d.ts` 添加类型定义

## 🎯 修复结果

### 之前的问题

- ❌ 路径: `/Users/Downloads` (不存在)
- ❌ 权限错误: `Permission denied`
- ❌ 下载失败

### 修复后的效果

- ✅ 路径: `/Users/{user}/Downloads` (用户真实目录)
- ✅ 权限正常: 可以创建文件和目录
- ✅ 下载成功: 文件保存到正确位置

## 🚀 验证步骤

1. **启动应用**:

   ```bash
   yarn start
   ```

2. **检查默认路径**:

   - 应用启动后，下载路径应该自动设置为用户的Downloads目录
   - 例如: `/Users/{user}/Downloads`

3. **测试下载**:

   - 输入视频链接
   - 获取视频信息
   - 开始下载
   - 验证文件保存到正确目录

4. **检查控制台日志**:
   - 应该看到详细的yt-dlp执行日志
   - 没有权限错误
   - 退出代码为0表示成功

## 📋 注意事项

1. **路径格式**:

   - 支持 `~` 符号表示用户目录
   - 自动解析为完整路径

2. **权限要求**:

   - 确保用户对Downloads目录有写权限
   - macOS可能需要授予应用文件访问权限

3. **错误处理**:
   - 所有错误都会在控制台记录
   - 用户界面显示友好的错误信息

现在下载功能应该能正常工作，不会再出现权限错误！
