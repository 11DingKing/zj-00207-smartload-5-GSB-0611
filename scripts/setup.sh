#!/bin/bash

set -e

echo "=========================================="
echo "🚀 SmartLoad 一键启动脚本"
echo "=========================================="
echo ""

if [ ! -f .env ]; then
  echo "📝 创建 .env 文件..."
  cp .env.example .env
  echo "✅ .env 文件已创建"
  echo ""
fi

echo "📦 安装依赖..."
npm install
echo ""

echo "🗄️  初始化数据库..."
npm run db:init
echo ""

echo "✅ 初始化完成！"
echo ""
echo "📋 可用命令："
echo "  npm run dev     - 启动开发服务器（自动重启）"
echo "  npm start       - 启动生产服务器"
echo "  npm run test    - 运行 API 测试"
echo "  npm run lint    - 代码质量检查"
echo "  npm run format  - 代码格式化"
echo ""
echo "🚀 启动服务："
echo "  npm run dev"
echo ""
