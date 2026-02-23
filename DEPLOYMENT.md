# 部署指南

## 系统要求

### 硬件要求

根据使用规模选择合适的硬件配置：

#### 最低配置（1-10 人）
- **CPU**: 单核 1.0 GHz 或更高
- **内存**: 512 MB RAM
- **存储**: 500 MB 可用空间
- **网络**: 10 Mbps 带宽

#### 推荐配置（10-50 人）
- **CPU**: 双核 2.0 GHz 或更高
- **内存**: 2 GB RAM
- **存储**: 2 GB 可用空间（含消息历史）
- **网络**: 50 Mbps 带宽

#### 大型部署（50-200 人）
- **CPU**: 四核 2.5 GHz 或更高
- **内存**: 4 GB RAM
- **存储**: 10 GB 可用空间
- **网络**: 100 Mbps 带宽

> **注意**: 如果启用 GPT-4o Bot，建议至少额外增加 512 MB 内存。

### 支持的操作系统

- **Windows**: Windows 10/11, Windows Server 2016+
- **macOS**: macOS 10.15 (Catalina) 或更高
- **Linux**: Ubuntu 18.04+, Debian 10+, CentOS 7+, RHEL 7+

### 网络配置要求

#### 端口要求

| 端口 | 协议 | 用途 | 是否必需 |
|------|------|------|----------|
| 3030 | TCP | HTTP/WebSocket 服务 | 必需 |
| 27017 | TCP | MongoDB（仅 Docker 部署） | 可选 |

#### 防火墙配置

**Windows 防火墙**:
```powershell
# 以管理员身份运行 PowerShell
netsh advfirewall firewall add rule name="Simple Chat Server" dir=in action=allow protocol=TCP localport=3030
```

**Linux 防火墙 (ufw)**:
```bash
sudo ufw allow 3030/tcp
sudo ufw reload
```

**Linux 防火墙 (firewalld)**:
```bash
sudo firewall-cmd --permanent --add-port=3030/tcp
sudo firewall-cmd --reload
```

#### 网络带宽估算

每个在线用户的平均带宽消耗：
- **文字消息**: 约 1-5 KB/消息
- **WebSocket 心跳**: 约 100 bytes/30秒
- **在线状态同步**: 约 1 KB/分钟

**示例**:
- 10 人同时在线，轻度聊天（每分钟 10 条消息）: ~2-5 Kbps
- 50 人同时在线，中度聊天（每分钟 50 条消息）: ~10-20 Kbps
- 200 人同时在线，重度聊天（每分钟 200 条消息）: ~50-100 Kbps

> **提示**: 局域网环境通常无需担心带宽问题，千兆网卡足以支持数百人使用。

#### 局域网部署建议

1. **静态 IP**: 建议为服务器分配静态 IP 地址，避免 IP 变化导致客户端无法连接
   ```bash
   # Windows - 在网络适配器设置中手动配置
   # Linux - 编辑 /etc/network/interfaces 或使用 netplan
   ```

2. **路由器配置**:
   - 确保路由器未启用 AP 隔离（无线客户端之间需要互通）
   - 如果服务器在内网，确保路由器允许内网设备访问服务器端口

3. **DNS 配置（可选）**:
   - 可以在路由器或本地 DNS 服务器中为服务器配置域名
   - 例如: `chat.local` → `192.168.1.100`

### 依赖软件

- **Node.js**: 版本 22.x 或更高（推荐最新 LTS）
  - 下载地址: https://nodejs.org/
  - 验证安装: `node --version`
  - **注意**: Node.js 22+ 提供更好的性能和安全性，低于此版本可能导致兼容性问题

- **npm**: 通常随 Node.js 一起安装
  - 验证安装: `npm --version`

- **Git** (可选，用于克隆仓库和版本管理):
  - 下载地址: https://git-scm.com/
  - 验证安装: `git --version`

### 安装/升级 Node.js

**Ubuntu/Debian**:
```bash
# 使用 NodeSource 安装 Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证版本
node --version  # 应显示 v22.x.x
```

**CentOS/RHEL**:
```bash
# 使用 NodeSource 安装 Node.js 22
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs

# 验证版本
node --version
```

**Windows**:
- 下载 Node.js 22 LTS 安装包: https://nodejs.org/
- 运行安装程序并重启终端

**macOS**:
```bash
# 使用 Homebrew
brew install node@22

# 或安装最新版本
brew install node

# 验证版本
node --version
```

**使用 nvm (推荐，适用于所有平台)**:
```bash
# 安装 nvm (Node Version Manager)
# Linux/macOS:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Windows: 下载 nvm-windows
# https://github.com/coreybutler/nvm-windows/releases

# 安装 Node.js 22
nvm install 22
nvm use 22

# 验证版本
node --version
```

## 在新设备上部署

### 1. 克隆仓库

```bash
git clone https://github.com/Kai-Cloud/lk-slc.git
cd lk-slc
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

### 防火墙配置

如果局域网设备无法访问，请参考上方"系统要求 → 网络配置要求 → 防火墙配置"部分。

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

- GitHub Issues: https://github.com/Kai-Cloud/lk-slc/issues
- 查看详细文档: [README.md](README.md)
- 快速开始: [QUICK_START.md](QUICK_START.md)
