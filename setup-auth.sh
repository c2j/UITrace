#!/bin/bash

# UITrace 真实认证系统快速设置脚本

set -e

echo "🚀 开始设置 UITrace 真实认证系统..."
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装。请先安装 Node.js 20+"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 检查 PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL 未安装。请确保 PostgreSQL 服务正在运行。"
fi

# 后端设置
echo ""
echo "📦 设置后端..."
cd backend

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "安装后端依赖..."
    npm install
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "创建 .env 文件..."
    cp .env.example .env
    echo "⚠️  请根据您的环境修改 backend/.env 文件中的配置"
fi

# Prisma 设置
echo "🔧 设置数据库..."
npm run db:generate
npm run db:migrate

# 创建默认管理员
echo "👤 创建默认管理员用户..."
npm run db:seed

echo "✅ 后端设置完成"
echo ""

# 前端设置
echo "📦 设置前端..."
cd ../frontend

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi

# 配置环境变量
echo "配置前端环境变量..."
cat > .env << EOL
# Backend API Configuration
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000

# Auth Configuration
VITE_JWT_KEY=uitrace_token

# Feature Flags
VITE_ENABLE_MOCK_DATA=false
EOL

echo "✅ 前端设置完成"
echo ""

# 返回项目根目录
cd ..

echo ""
echo "🎉 设置完成！"
echo ""
echo "📋 启动说明："
echo ""
echo "1. 启动后端（在 backend 目录）："
echo "   cd backend"
echo "   npm run dev"
echo ""
echo "2. 启动前端（在 frontend 目录）："
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "3. 访问应用："
echo "   http://localhost:5173"
echo ""
echo "🔑 默认管理员账户："
echo "   邮箱: admin@uitrace.com"
echo "   密码: admin123"
echo ""
echo "📖 详细文档请查看: AUTH_SETUP.md"
echo ""
