# Tailwind CSS 本地化设置

## 🚨 问题描述

遇到的错误：

```
Refused to load the script 'https://cdn.tailwindcss.com/' because it violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline'".
```

以及PostCSS插件错误：

```
[postcss] It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin. The PostCSS plugin has moved to a separate package...
```

## ✅ 解决方案

### 问题1: CSP错误

将Tailwind CSS从CDN改为本地安装。

### 问题2: PostCSS插件错误

这是因为意外安装了Tailwind CSS v4预览版，v4的PostCSS插件架构发生了变化。

## 🔧 修复步骤

### 1. 降级到稳定版本

```bash
# 移除v4版本
yarn remove tailwindcss @tailwindcss/cli

# 安装稳定的v3版本
yarn add -D tailwindcss@^3.4.0 postcss autoprefixer
```

### 2. 配置文件

- `tailwind.config.js` - Tailwind v3配置
- `postcss.config.js` - PostCSS配置
- `src/index.css` - 主样式文件

### 3. 移除CDN链接

从 `index.html` 中移除了：

```html
<script src="https://cdn.tailwindcss.com" crossorigin="anonymous"></script>
```

### 4. 更新动画类名

- 将 `animate-in` 改为 `animate-slide-in`
- 确保与Tailwind v3兼容

## 🎯 当前状态

- ✅ Tailwind CSS v3.4.17已安装
- ✅ 移除了v4预览版相关包
- ✅ 配置文件已更新
- ✅ CDN链接已移除
- ✅ CSS文件已导入到renderer.tsx
- ✅ 动画类名已修复

## 🚀 使用方法

直接运行应用即可：

```bash
yarn start
```

Vite会自动编译Tailwind CSS样式，无需手动构建。

## 📝 备用构建脚本

如果需要手动构建CSS（通常不需要）：

```bash
yarn build:css          # 单次构建
yarn build:css:watch    # 监听模式
```

## ⚠️ 注意事项

- 使用Tailwind CSS v3稳定版，避免v4预览版的兼容性问题
- Vite会自动处理PostCSS和Tailwind的集成
- 确保所有动画类名与配置文件中的定义一致

现在应用应该能正常运行，不会再出现CSP或PostCSS错误！
