# Vercel 部署指南

## 🚀 为什么部署到 Vercel？

- ✅ **HTTPS 支持**：解决 Safari 定位权限问题
- ✅ **免费托管**：个人项目完全免费
- ✅ **自动部署**：Git push 自动部署
- ✅ **全球 CDN**：快速访问
- ✅ **自定义域名**：可以绑定自己的域名

## 📋 部署前准备

### 1. 确保代码已提交到 Git

```bash
git init
git add .
git commit -m "Initial commit"
```

### 2. 推送到 GitHub/GitLab/Bitbucket

```bash
# 在 GitHub 创建新仓库后
git remote add origin https://github.com/你的用户名/ride-in-china.git
git push -u origin main
```

## 🔧 Vercel 部署步骤

### 方法一：通过 Vercel 网站（推荐）

1. **访问 Vercel**
   - 打开 https://vercel.com
   - 使用 GitHub/GitLab/Bitbucket 账号登录

2. **导入项目**
   - 点击 "Add New Project"
   - 选择你的 Git 仓库
   - 点击 "Import"

3. **配置项目**
   - **Framework Preset**: 选择 "Vite"（Vercel 会自动检测）
   - **Root Directory**: 留空（如果是根目录）
   - **Build Command**: `npm run build`（自动填充）
   - **Output Directory**: `dist`（自动填充）
   - **Install Command**: `npm install`（自动填充）

4. **设置环境变量**
   - 在 "Environment Variables" 部分
   - 添加：`GEMINI_API_KEY` = `你的API密钥`
   - 点击 "Add"

5. **部署**
   - 点击 "Deploy"
   - 等待构建完成（通常 1-2 分钟）

6. **获取 HTTPS 地址**
   - 部署完成后，Vercel 会提供一个 HTTPS 地址
   - 例如：`https://ride-in-china.vercel.app`
   - 这个地址可以用于测试！

### 方法二：通过 Vercel CLI

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录 Vercel
vercel login

# 3. 在项目目录运行
vercel

# 4. 按照提示操作
# - 是否链接到现有项目？选择 N（首次部署）
# - 项目名称？输入 ride-in-china
# - 目录？直接回车（使用当前目录）

# 5. 设置环境变量
vercel env add GEMINI_API_KEY

# 6. 部署到生产环境
vercel --prod
```

## 🔐 环境变量配置

### 必需的环境变量

在 Vercel 项目设置中添加：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `GEMINI_API_KEY` | Google Gemini API 密钥 | `AIza...` |

### 设置方法

1. 进入 Vercel 项目设置
2. 点击 "Environment Variables"
3. 添加变量：
   - **Name**: `GEMINI_API_KEY`
   - **Value**: 你的 API 密钥
   - **Environment**: 选择 `Production`, `Preview`, `Development`（全选）
4. 点击 "Save"
5. 重新部署项目（或等待自动部署）

## 📱 测试 HTTPS 访问

部署完成后：

1. **获取 HTTPS 地址**
   - Vercel 会提供：`https://你的项目名.vercel.app`
   - 或自定义域名（如果配置了）

2. **在 iPhone Safari 中访问**
   - 打开 Safari
   - 输入 HTTPS 地址
   - 现在 Safari 会显示 🔒 锁图标！

3. **设置定位权限**
   - 点击地址栏左侧的 🔒 锁图标
   - 选择 "网站设置"
   - 将 "位置" 设置为 "允许"
   - 完成！

4. **测试定位功能**
   - 点击应用中的定位按钮
   - 应该可以正常获取位置了！

## 🎯 部署后的优势

### ✅ 解决了定位权限问题

- **HTTPS 连接**：Safari 显示锁图标
- **网站级权限**：可以单独设置每个网站的权限
- **更好的安全性**：符合现代 Web 标准

### ✅ 更好的测试体验

- **真实环境**：接近生产环境
- **全球访问**：可以从任何地方访问
- **自动更新**：Git push 自动部署

## 🔄 持续部署

### 自动部署

每次 `git push` 到主分支，Vercel 会自动：
1. 检测代码变更
2. 运行构建命令
3. 部署新版本
4. 更新 HTTPS 地址

### 手动部署

```bash
# 在项目目录运行
vercel --prod
```

## 🐛 常见问题

### Q: 构建失败？

**A:** 检查：
- 环境变量是否已设置
- `package.json` 中的构建脚本是否正确
- 查看 Vercel 构建日志中的错误信息

### Q: Service Worker 不工作？

**A:** 
- 确保 `vercel.json` 中的 `rewrites` 配置正确
- 检查 `sw.js` 的路径是否正确
- Service Worker 只能在 HTTPS 下工作（Vercel 已提供）

### Q: 环境变量不生效？

**A:**
- 确保环境变量已添加到 Vercel 项目设置
- 重新部署项目（环境变量更改后需要重新部署）
- 检查变量名是否正确（区分大小写）

### Q: 如何查看部署日志？

**A:**
- 在 Vercel 项目页面点击 "Deployments"
- 点击具体的部署记录
- 查看 "Build Logs" 和 "Function Logs"

## 📝 下一步

部署成功后：

1. ✅ 在 iPhone Safari 中测试 HTTPS 访问
2. ✅ 设置定位权限（现在可以看到锁图标了！）
3. ✅ 测试所有功能
4. ✅ 分享 HTTPS 地址给其他人测试

## 🎉 完成！

现在你的应用已经部署到 Vercel，可以通过 HTTPS 访问了！

**HTTPS 地址示例**：`https://ride-in-china.vercel.app`

在 iPhone Safari 中访问这个地址，就可以正常设置定位权限了！
