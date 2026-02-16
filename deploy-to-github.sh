#!/bin/bash

# GitHub 部署脚本
# 仓库地址: https://github.com/siferzhong/rideinchinaDemo3.git

echo "🚀 开始部署到 GitHub..."

# 进入项目目录
cd "/Users/zhongtao/Downloads/ride-in-china---moto-tour-companion (3)"

# 初始化 Git 仓库（如果还没有）
if [ ! -d .git ]; then
    echo "📦 初始化 Git 仓库..."
    git init
fi

# 添加所有文件
echo "📝 添加文件到暂存区..."
git add .

# 提交更改
echo "💾 提交更改..."
git commit -m "Initial commit: Ride In China Moto Tour Companion"

# 检查是否已有远程仓库
if git remote | grep -q "origin"; then
    echo "🔄 更新远程仓库地址..."
    git remote set-url origin https://github.com/siferzhong/rideinchinaDemo3.git
else
    echo "🔗 添加远程仓库..."
    git remote add origin https://github.com/siferzhong/rideinchinaDemo3.git
fi

# 重命名分支为 main
echo "🌿 设置主分支为 main..."
git branch -M main

# 推送代码
echo "⬆️  推送代码到 GitHub..."
echo ""
echo "⚠️  如果提示输入用户名和密码："
echo "   Username: 输入你的 GitHub 用户名"
echo "   Password: 输入你的 Personal Access Token（不是密码）"
echo "   获取 Token: https://github.com/settings/tokens"
echo ""
git push -u origin main

echo ""
echo "✅ 完成！"
echo "📱 查看仓库: https://github.com/siferzhong/rideinchinaDemo3"
