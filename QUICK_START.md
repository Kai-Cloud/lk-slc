# 快速开始指南

## 5 分钟启动

### 1. 安装依赖

```bash
cd lk-slc    # 或 simple-lan-chat
npm install
```

> Ubuntu/Debian 首次需要：`sudo apt-get install -y build-essential python3`

### 2. 启动服务器

```bash
npm start
```

看到以下输出即成功：
```
🚀 简单局域网聊天系统已启动
📡 本地访问: http://localhost:3030
📡 局域网访问: http://YOUR_IP:3030
```

### 3. 登录使用

1. 浏览器访问 `http://localhost:3030`
2. 输入用户名 + 密码（首次即注册）
3. 自动进入"大厅"群聊

局域网其他设备访问 `http://服务器IP:3030`（查看IP：Linux `ip addr`，Windows `ipconfig`，macOS `ifconfig`）。

---

## 启动 GPT Bot（可选）

```bash
cd bots/gpt-bot
cp .env.example .env
# 编辑 .env，填入 BOT_PASSWORD / FOUNDRY_ENDPOINT / FOUNDRY_API_KEY
node index.js
```

Bot 上线后，在聊天中发送 `@gpt-bot 你的问题` 即可对话。私聊房间无需 @。

---

## 家人使用指南

### 手机访问

1. 确保手机与服务器在同一局域网
2. 手机浏览器访问 `http://服务器IP:3030`
3. 输入用户名 + 密码，开始聊天

### 添加到主屏幕

- **iOS**: Safari → 分享 → 添加到主屏幕
- **Android**: Chrome → 菜单(⋮) → 添加到主屏幕

添加后像 App 一样打开，无需每次输入地址。

### 日常使用

- 大厅群聊：所有人可见
- 私聊：点击左侧用户列表中的用户名
- 问 Bot：输入 `@gpt-bot 问题`（需管理员启动 Bot）

---

## PM2 后台运行（推荐）

```bash
npm install -g pm2

# 启动服务器
pm2 start server/index.js --name chat-server

# 启动 Bot
pm2 start bots/gpt-bot/index.js --name gpt-bot

# 开机自启
pm2 startup && pm2 save

# 常用命令
pm2 status       # 查看状态
pm2 logs         # 查看日志
pm2 restart all  # 重启全部
```

---

## 更多

- 生产部署（HTTPS / Nginx / 多平台）→ [DEPLOYMENT.md](DEPLOYMENT.md)
- 故障排除 → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- 项目概览 → [README.md](README.md)
