# 快速开始指南

## 🚀 5 分钟快速启动

### 步骤 1: 安装依赖

```bash
cd simple-lan-chat
npm install
```

### 步骤 2: 配置环境变量

```bash
# Windows
copy .env.example .env

# Mac/Linux
cp .env.example .env
```

编辑 `.env` 文件，暂时只需设置 Bot 密码:

```env
BOT_PASSWORD=123456
```

> 💡 如果要使用 GPT-4o Bot，需要配置 `FOUNDRY_ENDPOINT` 和 `FOUNDRY_API_KEY`

### 步骤 3: 启动服务器

```bash
npm start
```

看到以下输出表示成功:

```
========================================
🚀 简单局域网聊天系统已启动
========================================

📡 本地访问: http://localhost:3030
📡 局域网访问: http://YOUR_IP:3030

💡 提示: 使用 ipconfig (Windows) 或 ifconfig (Mac/Linux) 查看 IP 地址

========================================
```

### 步骤 4: 访问聊天

**本地测试:**
打开浏览器访问 `http://localhost:3030`

**局域网访问 (家人手机):**
1. 查看服务器 IP 地址:
   ```bash
   # Windows
   ipconfig

   # Mac/Linux
   ifconfig
   ```
2. 在手机浏览器访问: `http://服务器IP:3030`

### 步骤 5: 首次登录

1. 输入用户名 (例如: `alice`)
2. 输入密码 (随便设置，首次登录会自动注册)
3. 自动进入"大厅"群聊
4. 开始聊天! 🎉

## 🤖 启动 GPT-4o Bot (可选)

### 1. 配置 Bot

编辑 `.env` 文件，添加 GPT-4o 配置:

```env
BOT_USERNAME=gpt-bot
BOT_PASSWORD=bot123456

# 从 teams-gpt-bot 项目复制这两个配置
FOUNDRY_ENDPOINT=https://your-endpoint.azure.com/v1/chat/completions
FOUNDRY_API_KEY=your-api-key-here
```

### 2. 首次注册 Bot 用户

打开浏览器访问 `http://localhost:3030`:
1. 用户名: `gpt-bot`
2. 密码: `bot123456`
3. 登录后立即登出 (点击右上角🚪)

> 💡 这一步是为了在数据库中注册 Bot 账号

### 3. 启动 Bot

打开**新的终端窗口**:

```bash
cd simple-lan-chat
node bots/gpt-bot.js
```

看到以下输出表示成功:

```
========================================
🤖 GPT-4o Bot 启动中...
========================================

📡 正在登录服务器: http://localhost:3030
👤 Bot 用户名: gpt-bot

✅ 登录成功！
✅ WebSocket 已连接

========================================
🎉 Bot 已上线！
========================================

📍 Bot ID: 2
📍 用户名: gpt-bot

💡 提示: 在聊天中使用 @gpt-bot 来提及我

等待用户提及...
```

### 4. 测试 Bot

在网页聊天中发送:

```
@gpt-bot 你好，请介绍一下自己
```

Bot 会自动回复! 🎉

## 📱 家人使用指南

### 手机浏览器访问

1. 确保手机和服务器在同一局域网
2. 在手机浏览器访问: `http://服务器IP:3030`
3. 首次登录设置用户名和密码
4. 开始聊天

### 添加到主屏幕 (类似 App)

**iOS (iPhone/iPad):**
1. 在 Safari 中打开聊天页面
2. 点击底部"分享"按钮
3. 选择"添加到主屏幕"
4. 命名为"家庭聊天"
5. 完成！现在可以像 App 一样打开

**Android:**
1. 在 Chrome 中打开聊天页面
2. 点击右上角菜单 (三个点)
3. 选择"添加到主屏幕"
4. 命名为"家庭聊天"
5. 完成！

## 🔥 常见使用场景

### 场景 1: 家庭聊天

**设备:**
- 服务器: 家里的电脑/NAS
- 客户端: 家人的手机/平板

**用户:**
- 爸爸、妈妈、弟弟、姐姐

**使用:**
- 大家在"大厅"群聊
- 私聊讨论私事
- @gpt-bot 问问题

### 场景 2: 小团队协作

**设备:**
- 服务器: 办公室电脑
- 客户端: 团队成员电脑/手机

**用户:**
- 团队成员 + 多个 Bot (代码助手、翻译助手等)

**使用:**
- 项目讨论
- 快速提问
- Bot 辅助工作

### 场景 3: 学习小组

**设备:**
- 服务器: 宿舍电脑
- 客户端: 同学手机

**用户:**
- 同学 + 学习助手 Bot

**使用:**
- 讨论问题
- 分享笔记
- @bot 问作业

## 🛠️ 高级配置

### 修改端口

编辑 `.env`:

```env
PORT=8080
```

重启服务器，访问 `http://localhost:8080`

### 在其他设备运行 Bot

1. 在 Bot 设备上安装 Node.js
2. 复制整个 `simple-lan-chat` 文件夹
3. 编辑 `.env`:
   ```env
   SERVER_URL=http://服务器IP:3030
   BOT_USERNAME=gpt-bot
   BOT_PASSWORD=bot123456
   FOUNDRY_ENDPOINT=...
   FOUNDRY_API_KEY=...
   ```
4. 启动:
   ```bash
   node bots/gpt-bot.js
   ```

### 多个 Bot

复制 `bots/gpt-bot.js` 并修改:

```javascript
const BOT_USERNAME = 'translate-bot'; // 改成新名字
```

编辑 `.env` 添加新 Bot 配置，或使用不同的 `.env` 文件。

### 使用 PM2 后台运行

```bash
# 安装 PM2
npm install -g pm2

# 启动服务器
pm2 start server/index.js --name chat-server

# 启动 Bot
pm2 start bots/gpt-bot.js --name gpt-bot

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 设置开机自启
pm2 startup
pm2 save
```

## ❓ 故障排除

### 无法访问服务器

**检查:**
- 服务器是否正在运行? (`npm start`)
- 防火墙是否开放 3030 端口?
- IP 地址是否正确?

**Windows 防火墙:**
```powershell
netsh advfirewall firewall add rule name="Simple Chat" dir=in action=allow protocol=TCP localport=3030
```

### Bot 无法登录

**检查:**
- Bot 用户是否已注册? (先在网页登录一次)
- `.env` 中的密码是否正确?
- 服务器是否正在运行?

**调试:**
查看 Bot 终端输出的错误信息

### 消息不实时更新

**解决:**
- 刷新页面 (F5)
- 检查网络连接
- 查看浏览器控制台错误 (F12)

### 手机无法连接

**检查:**
- 手机和服务器是否在同一 WiFi?
- 使用服务器的局域网 IP (不是 localhost)
- 防火墙是否阻止局域网访问?

## 📊 性能说明

### 系统资源

- **服务器**: 约 30-50MB RAM
- **单个 Bot**: 约 40-60MB RAM
- **数据库**: SQLite 文件,随消息增长

### 支持规模

- **并发用户**: 50-100 人 (普通电脑)
- **消息吞吐**: 数百条/秒
- **历史消息**: 无限制 (受磁盘空间限制)

### 优化建议

**如果用户很多 (> 50人):**
- 使用更好的服务器
- 考虑使用 PostgreSQL 替代 SQLite
- 启用消息分页加载

**如果消息很多:**
- 定期清理旧消息
- 数据库备份

## 📝 下一步

- ✅ 添加更多 Bot (翻译、提醒、天气等)
- ✅ 自定义聊天主题
- ✅ 添加图片/文件传输
- ✅ 开发移动 App (React Native)

---

**🎉 享受你的局域网聊天系统!**

有问题查看 [README.md](README.md) 或检查服务器日志。
