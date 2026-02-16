# Git 同步指南

## 📌 重要说明

**Git 同步是手动触发的，不会自动同步！**

每次修改代码后，需要手动执行命令将更改推送到 GitHub。

## 🚀 立即同步到 GitHub

### 方法一：快速同步命令（复制到终端）

```bash
cd "/Users/zhongtao/Downloads/ride-in-china---moto-tour-companion (3)" && git add . && git commit -m "Update: $(date +%Y-%m-%d\ %H:%M:%S)" && git push
```

### 方法二：分步执行（推荐，可以看到每一步）

```bash
# 1. 进入项目目录
cd "/Users/zhongtao/Downloads/ride-in-china---moto-tour-companion (3)"

# 2. 查看修改的文件
git status

# 3. 添加所有修改的文件
git add .

# 4. 提交更改（可以自定义提交信息）
git commit -m "优化导航体验：增强3D效果和平滑跟随"

# 5. 推送到 GitHub
git push
```

## ⚡ 一键同步脚本

创建一个快捷脚本，方便以后使用：

### Mac 用户

1. **创建脚本文件**：
```bash
cat > ~/sync-ride-china.sh << 'EOF'
#!/bin/bash
cd "/Users/zhongtao/Downloads/ride-in-china---moto-tour-companion (3)"
echo "🔄 同步到 GitHub..."
git add .
git commit -m "Update: $(date +'%Y-%m-%d %H:%M:%S')"
git push
echo "✅ 同步完成！"
EOF

# 2. 添加执行权限
chmod +x ~/sync-ride-china.sh
```

2. **使用脚本**：
```bash
~/sync-ride-china.sh
```

## 🔄 设置自动同步（可选）

### 方法一：使用 Git Hooks（本地自动提交）

创建 Git hook，在每次保存文件时自动提交：

```bash
# 进入项目目录
cd "/Users/zhongtao/Downloads/ride-in-china---moto-tour-companion (3)"

# 创建 post-commit hook（提交后自动推送）
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
git push
EOF

chmod +x .git/hooks/post-commit
```

**注意**：这会在每次 `git commit` 后自动推送，但不会自动提交。

### 方法二：使用 GitHub Actions（自动部署到 Vercel）

如果你已经连接了 Vercel，Vercel 会在检测到 GitHub 推送时自动部署。

创建 `.github/workflows/auto-deploy.yml`：

```yaml
name: Auto Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## 📝 常用 Git 命令

### 查看状态
```bash
git status          # 查看哪些文件被修改了
git log             # 查看提交历史
git diff            # 查看具体修改内容
```

### 同步操作
```bash
git add .           # 添加所有修改
git commit -m "描述" # 提交更改
git push            # 推送到 GitHub
```

### 拉取最新代码
```bash
git pull            # 从 GitHub 拉取最新代码
```

### 查看远程仓库
```bash
git remote -v       # 查看远程仓库地址
```

## 🐛 常见问题

### Q: 推送时提示 "Everything up-to-date"？

**A:** 说明没有新的更改需要推送。先检查：
```bash
git status  # 查看是否有未提交的更改
```

如果有更改但没提交：
```bash
git add .
git commit -m "你的提交信息"
git push
```

### Q: 如何查看是否同步成功？

**A:** 
1. 访问你的 GitHub 仓库：https://github.com/siferzhong/rideinchinaDemo3
2. 查看最新的提交时间
3. 确认文件已更新

### Q: 可以设置定时自动同步吗？

**A:** 可以，但不推荐自动提交代码。更好的方式是：
- 使用 Git hooks 在提交后自动推送
- 使用 GitHub Actions 自动部署
- 手动控制提交时机（推荐）

## 💡 最佳实践

1. **频繁提交**：每次完成一个小功能就提交一次
2. **清晰的提交信息**：描述你做了什么修改
3. **推送前检查**：使用 `git status` 确认要提交的文件
4. **定期拉取**：如果多人协作，定期 `git pull` 获取最新代码

## 🎯 快速同步流程

**每次修改代码后**：

```bash
cd "/Users/zhongtao/Downloads/ride-in-china---moto-tour-companion (3)"
git add .
git commit -m "描述你的修改"
git push
```

**就是这么简单！** 🚀
