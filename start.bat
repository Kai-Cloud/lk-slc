@echo off
echo ========================================
echo 简单局域网聊天系统 - 快速启动
echo ========================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未安装 Node.js
    echo 请访问 https://nodejs.org 下载安装
    pause
    exit /b 1
)

echo [✓] Node.js 已安装
echo.

REM 检查依赖
if not exist "node_modules\" (
    echo [!] 正在安装依赖...
    call npm install
    echo.
)

echo [✓] 依赖已安装
echo.

REM 检查 .env 文件
if not exist ".env" (
    echo [!] 未找到 .env 文件
    echo [!] 正在从 .env.example 创建...
    copy .env.example .env
    echo.
    echo [注意] 如需使用 Bot，请编辑 .env 文件配置:
    echo   - BOT_PASSWORD (Bot 密码)
    echo   - FOUNDRY_ENDPOINT (GPT-4o 端点)
    echo   - FOUNDRY_API_KEY (GPT-4o 密钥)
    echo.
)

REM 启动服务器
echo [启动] 正在启动服务器...
echo.
node server/index.js
