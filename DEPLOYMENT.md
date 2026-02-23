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

### Ubuntu 系统依赖

**在 Ubuntu/Debian 上部署前,必须先安装构建工具:**

```bash
# 更新包索引
sudo apt-get update

# 安装编译工具和 Python (better-sqlite3 需要)
sudo apt-get install -y build-essential python3

# 验证安装
gcc --version
python3 --version
```

**说明**:
- `build-essential` 包含 gcc, g++, make 等编译工具
- `python3` 是 node-gyp 的依赖项
- 这些工具用于编译 better-sqlite3 原生模块
- 仅在首次安装时需要,后续运行不再依赖

**故障排除**:
如果遇到 `libnode.so.64: cannot open shared object file` 错误,说明构建工具未安装。按照上述步骤安装后,需要重新安装 npm 依赖:

```bash
cd ~/lk-slc
rm -rf node_modules package-lock.json
npm install  # 会自动编译 better-sqlite3
npm start    # 启动服务器
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

### HTTPS 部署（Nginx 反向代理）

如果需要通过 HTTPS 在公网访问聊天服务器，可以使用 Nginx 作为反向代理。以下以 Ubuntu 系统为例，使用 Nginx 监听 **63030 端口（HTTPS）** 并代理到本机 **3030 端口（HTTP）**。

#### 前置条件

- 已按照前述步骤安装并启动聊天服务器（运行在 `http://localhost:3030`）
- 服务器有公网 IP 地址或域名
- 已开放防火墙端口 63030

#### 步骤 1: 安装 Nginx

```bash
# 更新包索引
sudo apt-get update

# 安装 Nginx
sudo apt-get install -y nginx

# 验证安装
nginx -v
# 应输出: nginx version: nginx/x.x.x

# 启动 Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# 检查状态
sudo systemctl status nginx
```

#### 步骤 2: 创建自签名 SSL 证书

**注意**: 自签名证书会在浏览器中显示安全警告。生产环境建议使用 Let's Encrypt 等免费证书颁发机构。

```bash
# 创建证书存放目录
sudo mkdir -p /etc/nginx/ssl

# 生成自签名证书（有效期 365 天）
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/chat.key \
  -out /etc/nginx/ssl/chat.crt

# 在交互式提示中输入信息（示例）：
# Country Name: CN
# State or Province Name: Beijing
# Locality Name: Beijing
# Organization Name: My Company
# Organizational Unit Name: IT
# Common Name: your-server-ip-or-domain.com  # 重要: 填写服务器 IP 或域名
# Email Address: admin@example.com

# 设置证书文件权限
sudo chmod 600 /etc/nginx/ssl/chat.key
sudo chmod 644 /etc/nginx/ssl/chat.crt

# 验证证书
sudo openssl x509 -in /etc/nginx/ssl/chat.crt -text -noout | grep "Subject:"
```

**使用 Let's Encrypt 免费证书（可选，推荐生产环境）**:
```bash
# 安装 Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 获取证书（需要域名）
sudo certbot --nginx -d your-domain.com

# 证书会自动配置到 Nginx 并自动续期
```

#### 步骤 3: 配置 Nginx 反向代理

创建 Nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-available/simple-chat
```

粘贴以下配置内容：

```nginx
# HTTPS 服务器（仅监听 63030 端口）
server {
    listen 63030 ssl http2;
    listen [::]:63030 ssl http2;
    server_name _;  # 如果有域名，改为域名

    # SSL 证书配置
    ssl_certificate /etc/nginx/ssl/chat.crt;
    ssl_certificate_key /etc/nginx/ssl/chat.key;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 日志
    access_log /var/log/nginx/chat_access.log;
    error_log /var/log/nginx/chat_error.log;

    # 反向代理配置
    location / {
        proxy_pass http://localhost:3030;
        proxy_http_version 1.1;

        # 传递客户端真实 IP
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持（Socket.io 必需）
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

**重要说明**:
- 本配置**仅使用 63030 端口**用于 HTTPS 访问
- **不需要** 80 (HTTP) 或 443 (HTTPS) 端口
- 如果系统中已有其他 Web 服务（如 Apache），不会产生冲突
- 用户直接访问 `https://<服务器IP>:63030` 即可

**配置说明**:
- **listen 63030 ssl http2**: 仅监听 63030 端口的 HTTPS 连接，启用 HTTP/2
- **listen [::]:63030 ssl http2**: IPv6 支持
- **proxy_pass http://localhost:3030**: 转发到本地聊天服务器
- **Upgrade/Connection 头**: 支持 WebSocket 长连接（Socket.io 实时通信）
- **SSL 证书路径**: `/etc/nginx/ssl/chat.crt` 和 `/etc/nginx/ssl/chat.key`

#### 步骤 4: 启用配置并重启 Nginx

```bash
# 禁用默认站点（避免端口冲突，推荐）
sudo rm /etc/nginx/sites-enabled/default

# 创建符号链接启用站点
sudo ln -s /etc/nginx/sites-available/simple-chat /etc/nginx/sites-enabled/

# 验证启用的站点
ls -l /etc/nginx/sites-enabled/
# 应只显示: simple-chat -> /etc/nginx/sites-available/simple-chat

# 测试配置文件语法
sudo nginx -t
# 应输出: syntax is ok, test is successful

# 启动 Nginx（如果之前停止了）
sudo systemctl start nginx

# 或重新加载配置（如果 Nginx 正在运行）
sudo systemctl reload nginx

# 检查运行状态
sudo systemctl status nginx
# 应显示: Active: active (running)

# 验证监听端口
sudo netstat -tlnp | grep nginx
# 应只显示 63030 端口，不应有 80/443 端口
```

#### 步骤 5: 配置防火墙

**Ubuntu 防火墙 (ufw)**:
```bash
# 允许 63030 端口（HTTPS）
sudo ufw allow 63030/tcp

# 如果需要禁用原来的 3030 端口公网访问（提高安全性）
sudo ufw deny 3030/tcp

# 重新加载防火墙
sudo ufw reload

# 查看规则
sudo ufw status
```

**Azure/云服务商网络安全组（NSG）**:
- 在云服务控制台添加入站规则：
  - 端口: **63030**
  - 协议: **TCP**
  - 源: **Any**（或限制特定 IP）
  - 操作: **允许**
- 可选：移除 3030 端口的公网访问规则（仅允许本地访问）

#### 步骤 6: 测试 HTTPS 访问

1. **获取服务器公网 IP**:
   ```bash
   curl ifconfig.me
   # 输出: 123.45.67.89
   ```

2. **浏览器访问**:
   - URL: `https://123.45.67.89:63030`
   - 如果使用自签名证书，浏览器会显示安全警告，点击「高级」→「继续访问」即可

3. **验证 WebSocket 连接**:
   - 打开浏览器开发者工具（F12）→ Network 标签
   - 筛选 WS（WebSocket）
   - 应该看到 `wss://your-ip:63030/socket.io/?...` 连接成功

4. **测试功能**:
   - 注册/登录用户
   - 发送消息
   - 检查实时通信是否正常

#### 步骤 7: 使用 PM2 后台运行服务器

确保聊天服务器后台运行，避免 SSH 断开后停止：

```bash
# 安装 PM2
npm install -g pm2

# 启动服务器
pm2 start server/index.js --name chat-server

# 设置开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs chat-server
```

#### 故障排除

**问题 1: Nginx 启动失败（端口被占用）**
- **错误信息**:
  ```
  nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)
  nginx: [emerg] bind() to 0.0.0.0:443 failed (98: Address already in use)
  ```
- **原因**: 系统中已有其他服务（如 Apache）占用 80/443 端口，或 Nginx 配置文件监听了这些端口
- **解决步骤**:
  ```bash
  # 1. 检查哪些进程占用 80/443 端口
  sudo netstat -tlnp | grep ':80 '
  sudo netstat -tlnp | grep ':443'
  # 或使用 lsof
  sudo lsof -i :80
  sudo lsof -i :443

  # 2. 如果是 Apache 占用（且不需要 Apache）
  sudo systemctl stop apache2
  sudo systemctl disable apache2

  # 3. 如果是旧的 Nginx 进程
  sudo systemctl stop nginx
  sudo killall nginx

  # 4. 禁用 Nginx 默认站点（避免监听 80/443）
  sudo rm /etc/nginx/sites-enabled/default

  # 5. 确保配置文件只监听 63030 端口
  sudo nano /etc/nginx/sites-available/simple-chat
  # 确认配置中只有 "listen 63030 ssl http2"，没有 80/443 端口

  # 6. 测试并启动
  sudo nginx -t
  sudo systemctl start nginx

  # 7. 验证端口监听
  sudo netstat -tlnp | grep nginx
  # 应只显示 63030 端口
  ```

**问题 2: 浏览器显示"连接不安全"**
- **原因**: 自签名证书未被浏览器信任
- **解决**:
  - 测试环境：点击「高级」→「继续访问」
  - 生产环境：使用 Let's Encrypt 证书

**问题 3: WebSocket 连接失败 (net::ERR_CONNECTION_CLOSED)**
- **检查 Nginx 配置**: 确保包含 `Upgrade` 和 `Connection` 头
- **检查防火墙**: 确保 63030 端口已开放
- **查看 Nginx 日志**:
  ```bash
  sudo tail -f /var/log/nginx/chat_error.log
  ```

**问题 4: 502 Bad Gateway**
- **原因**: Nginx 无法连接到后端服务器（3030 端口）
- **解决**:
  ```bash
  # 检查聊天服务器是否运行
  pm2 status

  # 检查 3030 端口是否监听
  sudo netstat -tlnp | grep 3030

  # 重启服务器
  pm2 restart chat-server
  ```

**问题 5: 证书过期**
- 自签名证书 365 天后过期，需要重新生成：
  ```bash
  sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/chat.key \
    -out /etc/nginx/ssl/chat.crt
  sudo systemctl reload nginx
  ```

#### 高级配置: 使用域名

如果你有域名（例如 `chat.example.com`）：

1. **DNS 配置**: 添加 A 记录指向服务器 IP
   ```
   chat.example.com  A  123.45.67.89
   ```

2. **修改 Nginx 配置**:
   ```nginx
   server {
       listen 443 ssl;  # 使用标准 HTTPS 端口
       server_name chat.example.com;

       # 其他配置同上...
   }
   ```

3. **获取 Let's Encrypt 证书**:
   ```bash
   sudo certbot --nginx -d chat.example.com
   ```

4. **访问**: `https://chat.example.com`

#### 安全建议

1. **禁用 HTTP 公网访问**: 只开放 HTTPS（63030 或 443），关闭 HTTP（3030）的公网访问
2. **使用真实证书**: 生产环境使用 Let's Encrypt 或商业 SSL 证书
3. **限制访问 IP**: 如果只有特定 IP 访问，在 Nginx 中配置白名单
   ```nginx
   location / {
       allow 192.168.1.0/24;  # 允许局域网
       allow 123.45.67.89;    # 允许特定公网 IP
       deny all;              # 拒绝其他
       proxy_pass http://localhost:3030;
   }
   ```
4. **启用 HTTP/2**: 提升性能
   ```nginx
   listen 63030 ssl http2;
   ```
5. **定期更新证书**: 使用 Certbot 自动续期

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
