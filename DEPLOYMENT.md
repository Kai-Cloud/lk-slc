# 部署指南

## 在新设备上部署

### 1. 克隆仓库

```bash
git clone https://github.com/Kai-Cloud/lk.git
cd lk
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制示例文件：
```bash
# Windows
copy .env.example .env

# Mac/Linux
cp .env.example .env
```

编辑 `.env` 文件，配置以下变量：

```env
# 服务器配置
PORT=3030
HOST=0.0.0.0

# JWT 密钥（生产环境请修改为随机字符串）
JWT_SECRET=your-super-secret-key-change-in-production

# Bot 配置
BOT_USERNAME=gpt-bot
BOT_PASSWORD=your-bot-password

# GPT-4o 配置（如果使用 Bot）
FOUNDRY_ENDPOINT=https://your-foundry-endpoint/v1/chat/completions
FOUNDRY_API_KEY=your-api-key-here
```

### 4. 启动服务器

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

### 5. 访问应用

- **本地**: http://localhost:3030
- **局域网**: http://YOUR_IP:3030

查看 IP 地址：
```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
```

## 启动 GPT-4o Bot（可选）

需要先在网页端注册 Bot 账号（使用 BOT_USERNAME 和 BOT_PASSWORD 登录一次）。

然后在新终端窗口运行：
```bash
node bots/gpt-bot.js
```

## 生产环境部署

### 使用 PM2 后台运行

1. 安装 PM2：
```bash
npm install -g pm2
```

2. 启动服务：
```bash
# 服务器
pm2 start server/index.js --name chat-server

# Bot（如果需要）
pm2 start bots/gpt-bot.js --name gpt-bot

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 停止服务
pm2 stop chat-server
pm2 stop gpt-bot

# 设置开机自启
pm2 startup
pm2 save
```

### Windows 防火墙配置

如果局域网设备无法访问，需要开放端口：

```powershell
# 以管理员身份运行 PowerShell
netsh advfirewall firewall add rule name="Simple Chat" dir=in action=allow protocol=TCP localport=3030
```

### 数据备份

重要数据位于 `data/` 目录：
- `data/chat.db` - 用户、消息、房间数据

定期备份：
```bash
# Windows
copy data\chat.db backups\chat-%date%.db

# Mac/Linux
cp data/chat.db backups/chat-$(date +%Y%m%d).db
```

## 更新代码

在已部署的设备上更新：

```bash
# 拉取最新代码
git pull origin main

# 安装新依赖（如果有）
npm install

# 重启服务
# 如果使用 PM2
pm2 restart chat-server

# 如果直接运行
# 停止当前进程 (Ctrl+C) 然后重新运行:
npm start
```

## 故障排除

### 端口被占用
```bash
# Windows - 查找占用端口的进程
netstat -ano | findstr :3030

# 杀死进程
taskkill /PID <进程ID> /F

# Mac/Linux
lsof -i :3030
kill <进程ID>
```

### 数据库错误

如果遇到数据库问题，删除并重新初始化：
```bash
# 备份旧数据
copy data\chat.db data\chat.backup.db

# 删除数据库
del data\chat.db

# 重启服务器会自动创建新数据库
npm start
```

### Bot 无法连接

1. 确认服务器正在运行
2. 确认 Bot 账号已在网页端注册
3. 确认 `.env` 文件配置正确
4. 查看 Bot 终端输出的错误信息

## 多设备同步开发

### 提交代码到 GitHub

```bash
# 查看修改
git status

# 添加所有修改
git add .

# 创建提交
git commit -m "描述你的修改"

# 推送到 GitHub
git push origin main
```

### 从其他设备拉取

```bash
# 拉取最新代码
git pull origin main

# 如果有冲突，需要手动解决后：
git add .
git commit -m "解决冲突"
git push origin main
```

## 项目结构

```
simple-lan-chat/
├── server/           # 服务器端代码
│   ├── index.js     # 主服务器 + Socket.io
│   ├── db.js        # 数据库操作
│   └── auth.js      # 认证逻辑
├── public/          # 前端静态文件
│   ├── index.html   # 登录页面
│   ├── chat.html    # 聊天界面
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js   # 前端逻辑
├── bots/            # Bot 客户端
│   └── gpt-bot.js   # GPT-4o Bot
├── data/            # 数据目录（自动创建）
│   └── chat.db      # SQLite 数据库
├── .env             # 环境变量（不提交到 Git）
├── .env.example     # 环境变量示例
├── package.json     # 项目依赖
├── start.bat        # Windows 快速启动脚本
├── README.md        # 项目说明
└── QUICK_START.md   # 快速开始指南
```

## 安全建议

1. **修改 JWT_SECRET**: 生产环境务必修改为强随机密钥
2. **修改 Bot 密码**: 使用强密码
3. **防火墙**: 仅局域网使用时，不要暴露到公网
4. **HTTPS**: 如需公网访问，建议配置反向代理和 SSL 证书
5. **备份**: 定期备份 `data/chat.db` 文件

## 技术支持

- GitHub Issues: https://github.com/Kai-Cloud/lk/issues
- 查看详细文档: [README.md](README.md)
- 快速开始: [QUICK_START.md](QUICK_START.md)
