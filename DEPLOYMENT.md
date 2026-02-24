# 部署指南

本指南以 **Ubuntu/Linux** 部署为主，其他操作系统请参考相应章节调整。

## 系统要求

### 硬件要求

根据使用规模选择合适的硬件配置：

| 规模 | CPU | 内存 | 存储 | 网络带宽 |
|------|-----|------|------|---------|
| 小型 (1-10人) | 单核 1.0 GHz | 512 MB | 500 MB | 10 Mbps |
| 中型 (10-50人) | 双核 2.0 GHz | 2 GB | 2 GB | 50 Mbps |
| 大型 (50-200人) | 四核 2.5 GHz | 4 GB | 10 GB | 100 Mbps |

> **提示**: 启用 GPT-4o Bot 需额外 512 MB 内存。局域网环境通常无需担心带宽问题。

### 支持的操作系统

- **Linux**: Ubuntu 18.04+, Debian 10+, CentOS 7+, RHEL 7+ (推荐)
- **Windows**: Windows 10/11, Windows Server 2016+
- **macOS**: macOS 10.15 (Catalina) 或更高

### 网络配置要求

#### 端口要求

| 端口 | 协议 | 用途 | 是否必需 |
|------|------|------|----------|
| 3030 | TCP | HTTP/WebSocket 服务 | 必需 (局域网) |
| 63030 | TCP | HTTPS 服务 (Nginx) | 可选 (公网访问) |

#### 防火墙配置

**Ubuntu/Debian (ufw)**:
```bash
sudo ufw allow 3030/tcp
sudo ufw reload
```

**CentOS/RHEL (firewalld)**:
```bash
sudo firewall-cmd --permanent --add-port=3030/tcp
sudo firewall-cmd --reload
```

**Windows**:
```powershell
# 以管理员身份运行 PowerShell
netsh advfirewall firewall add rule name="Simple Chat Server" dir=in action=allow protocol=TCP localport=3030
```

### 软件依赖

- **Node.js 22.x** (必需): https://nodejs.org/
- **npm**: 随 Node.js 一起安装
- **Git** (可选): 用于克隆仓库和版本管理

---

## Ubuntu 快速部署

### 1. 安装依赖

```bash
# 更新包索引
sudo apt-get update

# 安装 Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装构建工具（better-sqlite3 需要）
sudo apt-get install -y build-essential python3

# 验证安装
node --version  # 应显示 v22.x.x
npm --version
gcc --version
python3 --version
```

**重要**: `build-essential` 和 `python3` 是编译 better-sqlite3 原生模块的必需依赖，缺少会导致安装失败。

### 2. 克隆仓库

```bash
git clone https://github.com/Kai-Cloud/lk-slc.git
cd lk-slc
```

### 3. 安装 NPM 依赖

```bash
npm install
```

### 4. 配置环境变量（可选）

```bash
cp .env.example .env
nano .env
```

编辑 `.env` 文件（通常保持默认即可）:
```env
PORT=3030
HOST=0.0.0.0
# JWT_SECRET=your-custom-secret  # 可选
```

### 5. 启动服务器

**开发模式（推荐测试使用）**:
```bash
npm run dev
```

**生产模式**:
```bash
npm start
```

### 6. 验证部署

```bash
# 查看本机 IP
ip addr show | grep inet

# 访问测试
curl http://localhost:3030
# 应返回 HTML 登录页面
```

在浏览器打开 `http://YOUR_IP:3030`，看到登录页面即部署成功。

---

## 生产环境配置 (PM2)

### 安装并配置 PM2

PM2 是 Node.js 进程管理器，用于后台运行和自动重启。

```bash
# 全局安装 PM2
npm install -g pm2

# 启动聊天服务器
pm2 start server/index.js --name chat-server

# 查看运行状态
pm2 status

# 查看日志
pm2 logs chat-server

# 设置开机自启
pm2 startup
# 执行输出的命令（通常需要 sudo）

pm2 save
```

### PM2 常用命令

```bash
# 重启服务
pm2 restart chat-server

# 停止服务
pm2 stop chat-server

# 删除服务
pm2 delete chat-server

# 查看详细信息
pm2 show chat-server

# 监控资源使用
pm2 monit
```

--- HTTPS 部署（Nginx 反向代理）

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

## 其他平台部署

### Windows 部署

```powershell
# 克隆仓库
git clone https://github.com/Kai-Cloud/lk-slc.git
cd lk-slc

# 安装依赖
npm install

# 启动服务器
npm start
```

### macOS 部署

```bash
# 安装 Homebrew (如果没有)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Node.js
brew install node

# 克隆仓库
git clone https://github.com/Kai-Cloud/lk-slc.git
cd lk-slc

# 安装依赖
npm install

# 启动服务器
npm start
```

---

## 数据管理

### 数据备份

重要数据位于 `data/chat.db` (SQLite 数据库文件):

```bash
# 手动备份
cp data/chat.db backups/chat-$(date +%Y%m%d).db

# 定期备份 (crontab)
0 2 * * * cd ~/lk-slc && cp data/chat.db backups/chat-$(date +\%Y\%m\%d).db
```

### 数据库迁移

如需迁移到新服务器:

```bash
# 旧服务器导出
cp data/chat.db /tmp/chat-backup.db

# 传输到新服务器 (scp)
scp /tmp/chat-backup.db user@new-server:~/lk-slc/data/chat.db

# 新服务器重启
pm2 restart chat-server
```

---

## 更新代码

```bash
# 拉取最新代码
git pull origin main

# 安装新依赖
npm install

# 重启服务
pm2 restart chat-server
```

---

## 技术支持

- **GitHub Issues**: https://github.com/Kai-Cloud/lk-slc/issues
- **故障排查**: 查看 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **快速开始**: 查看 [README.md](README.md)
