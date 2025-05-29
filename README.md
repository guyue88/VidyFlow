# XDown - 视频下载器

一个基于 Electron + React + TypeScript 的现代化视频下载器，支持多平台视频下载。

## 功能特性

- 🎥 支持多平台视频下载（YouTube、Facebook、Twitter等）
- 🎨 现代化的用户界面，基于 React + Tailwind CSS
- 📱 响应式设计，适配不同屏幕尺寸
- 📊 实时下载进度显示
- 📁 自定义下载路径选择
- 🎛️ 多种视频质量选项
- 📝 下载历史记录
- 🔧 基于 Electron Forge 官方脚手架

## 技术栈

- **前端框架**: React 19 + TypeScript
- **桌面应用**: Electron 36
- **构建工具**: Vite 5 + Electron Forge
- **UI 框架**: Tailwind CSS
- **图标库**: Lucide React
- **代码规范**: ESLint + Prettier
- **包管理器**: Yarn

## 开发环境要求

- Node.js >= 16
- Yarn
- yt-dlp (用于视频下载)

## 安装依赖

```bash
yarn install
```

## 开发模式

```bash
yarn start
```

## 构建应用

```bash
# 打包应用
yarn package

# 创建分发包
yarn make
```

## 代码规范

```bash
# 检查代码规范
yarn lint

# 自动修复代码规范问题
yarn lint:fix

# 格式化代码
yarn format

# 检查代码格式
yarn format:check

# 类型检查
yarn type-check
```

## 项目结构

```
xdown/
├── src/
│   ├── main.ts          # 主进程
│   ├── preload.ts       # 预加载脚本
│   ├── renderer.tsx     # 渲染进程入口
│   ├── App.tsx          # React 主组件
│   ├── index.css        # 样式文件
│   └── global.d.ts      # 全局类型定义
├── forge.config.ts      # Electron Forge 配置
├── vite.*.config.ts     # Vite 配置文件
├── tsconfig.json        # TypeScript 配置
├── .eslintrc.json       # ESLint 配置
├── .prettierrc.json     # Prettier 配置
└── package.json         # 项目配置
```

## 使用说明

1. **输入视频链接**: 在输入框中粘贴要下载的视频URL
2. **获取视频信息**: 点击"获取信息"按钮查看视频详情
3. **选择下载路径**: 点击文件夹图标选择保存位置
4. **选择视频质量**: 从下拉菜单中选择所需的视频质量
5. **开始下载**: 点击"开始下载"按钮开始下载
6. **查看进度**: 实时查看下载进度和状态
7. **管理历史**: 在下载历史中查看已完成的下载

## 支持的平台

- YouTube
- Facebook
- Twitter
- Instagram
- TikTok
- 以及其他 yt-dlp 支持的平台

## 注意事项

- 请确保已安装 `yt-dlp` 工具
- 下载视频时请遵守相关平台的使用条款
- 建议在良好的网络环境下使用

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0

- 初始版本发布
- 基于 Electron Forge 官方脚手架重构
- 支持多平台视频下载
- 现代化 UI 设计
- 完整的 TypeScript 支持
