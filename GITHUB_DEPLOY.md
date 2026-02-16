# GitHub 部署指南

## 📋 步骤一：初始化 Git 仓库

在终端中，进入项目目录并运行以下命令：

```bash
# 1. 进入项目目录
cd "/Users/zhongtao/Downloads/ride-in-china---moto-tour-companion (3)"

# 2. 初始化 Git 仓库
git init

# 3. 添加所有文件到暂存区
git add .

# 4. 创建首次提交
git commit -m "Initial commit: Ride In China Moto Tour Companion"
```

## 🔗 步骤二：在 GitHub 创建仓库

### 方法一：通过 GitHub 网站创建

1. **登录 GitHub**
   - 访问 https://github.com
   - 登录你的账号（如果没有账号，先注册）

2. **创建新仓库**
   - 点击右上角的 "+" 图标
   - 选择 "New repository"

3. **填写仓库信息**
   - **Repository name**: `ride-in-china`（或你喜欢的名字）
   - **Description**: `Motorcycle tour companion app for riders in China`
   - **Visibility**: 选择 "Public"（公开）或 "Private"（私有）
   - ⚠️ **重要**：**不要**勾选 "Initialize this repository with a README"
   - ⚠️ **不要**添加 .gitignore 或 license（我们已经有了）

4. **创建仓库**
   - 点击绿色的 "Create repository" 按钮

5. **复制仓库地址**
   - GitHub 会显示仓库地址，类似：
   - `https://github.com/你的用户名/ride-in-china.git`
   - 复制这个地址，下一步会用到

### 方法二：通过 GitHub CLI（如果已安装）

```bash
# 安装 GitHub CLI（如果还没安装）
# brew install gh  # Mac
# 或访问 https://cli.github.com

# 登录 GitHub
gh auth login

# 创建仓库
gh repo create ride-in-china --public --source=. --remote=origin --push
```

## 🚀 步骤三：连接本地仓库到 GitHub

在终端中运行：

```bash
# 1. 添加远程仓库（替换成你的GitHub用户名和仓库名）
git remote add origin https://github.com/你的用户名/ride-in-china.git

# 例如：git remote add origin https://github.com/zhongtao/ride-in-china.git

# 2. 检查远程仓库是否添加成功
git remote -v

# 3. 重命名主分支为 main（如果GitHub要求）
git branch -M main

# 4. 推送代码到 GitHub
git push -u origin main
```

## 🔐 步骤四：处理身份验证

如果推送时要求输入用户名和密码：

### 方法一：使用 Personal Access Token（推荐）

1. **创建 Token**
   - 访问：https://github.com/settings/tokens
   - 点击 "Generate new token" → "Generate new token (classic)"
   - **Note**: 输入 `ride-in-china-deploy`
   - **Expiration**: 选择过期时间（建议 90 天或 No expiration）
   - **Scopes**: 勾选 `repo`（完整仓库权限）
   - 点击 "Generate token"
   - ⚠️ **重要**：复制生成的 token（只显示一次！）

2. **使用 Token 推送**
   ```bash
   # 当提示输入密码时，使用 token 而不是密码
   git push -u origin main
   # Username: 你的GitHub用户名
   # Password: 粘贴刚才复制的token
   ```

### 方法二：使用 SSH（更安全，推荐长期使用）

1. **检查是否已有 SSH 密钥**
   ```bash
   ls -al ~/.ssh
   ```

2. **如果没有，生成新的 SSH 密钥**
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   # 按回车使用默认路径
   # 设置密码（可选，但推荐）
   ```

3. **添加 SSH 密钥到 ssh-agent**
   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   ```

4. **复制公钥**
   ```bash
   cat ~/.ssh/id_ed25519.pub
   # 复制输出的内容
   ```

5. **添加到 GitHub**
   - 访问：https://github.com/settings/keys
   - 点击 "New SSH key"
   - **Title**: `MacBook Air`（或你的设备名）
   - **Key**: 粘贴刚才复制的公钥
   - 点击 "Add SSH key"

6. **使用 SSH 地址连接**
   ```bash
   # 删除之前的 HTTPS 远程地址
   git remote remove origin
   
   # 添加 SSH 地址（替换成你的用户名）
   git remote add origin git@github.com:你的用户名/ride-in-china.git
   
   # 推送
   git push -u origin main
   ```

## ✅ 验证部署成功

推送成功后：

1. **刷新 GitHub 仓库页面**
   - 应该能看到所有文件

2. **检查文件**
   - 确认所有重要文件都已上传
   - 确认 `.env.local` 等敏感文件**没有**被上传（在 .gitignore 中）

## 📝 后续更新代码

以后修改代码后，使用以下命令更新 GitHub：

```bash
# 1. 查看修改的文件
git status

# 2. 添加修改的文件
git add .

# 3. 提交修改
git commit -m "描述你的修改内容"

# 4. 推送到 GitHub
git push
```

## 🐛 常见问题

### Q: 提示 "remote origin already exists"？

**A:** 删除旧的远程仓库，重新添加：
```bash
git remote remove origin
git remote add origin https://github.com/你的用户名/ride-in-china.git
```

### Q: 推送时提示 "Permission denied"？

**A:** 
- 检查用户名和密码是否正确
- 如果使用密码，确保使用 Personal Access Token
- 如果使用 SSH，确保 SSH 密钥已添加到 GitHub

### Q: 如何查看远程仓库地址？

**A:**
```bash
git remote -v
```

### Q: 如何修改远程仓库地址？

**A:**
```bash
git remote set-url origin https://github.com/你的新用户名/新仓库名.git
```

## 🎯 下一步：部署到 Vercel

代码推送到 GitHub 后，就可以：

1. 访问 https://vercel.com
2. 导入 GitHub 仓库
3. 自动部署到 HTTPS

详细步骤请查看 `VERCEL_DEPLOY.md`

## 📚 有用的 Git 命令

```bash
# 查看状态
git status

# 查看提交历史
git log

# 查看远程仓库
git remote -v

# 拉取最新代码
git pull

# 创建新分支
git checkout -b feature/新功能名

# 切换分支
git checkout main
```

---

**提示**：如果遇到任何问题，可以查看 Git 错误信息，或者告诉我具体的错误，我会帮你解决！
