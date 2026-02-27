# 故障排查指南 (Troubleshooting Guide)

本文档收录部署和运行过程中遇到的常见问题及解决方案。

---

## 目录

1. [Node.js 和依赖问题](#nodejs-和依赖问题)
2. [网络和防火墙问题](#网络和防火墙问题)
3. [HTTPS 和 SSL 证书问题](#https-和-ssl-证书问题)
4. [数据库问题](#数据库问题)
5. [Bot 问题](#bot-问题)
6. [PM2 和进程管理问题](#pm2-和进程管理问题)

---

## Node.js 和依赖问题

### 问题 1: Ubuntu 安装依赖失败 (`libnode.so.64: cannot open shared object file`)

**错误信息**:
```
Error: libnode.so.64: cannot open shared object file: No such file or directory
```

**原因**: better-sqlite3 需要编译工具 (gcc, g++, python3) 来编译原生模块，但系统未安装。

**解决方案**:

```bash
# 安装构建工具
sudo apt-get update
sudo apt-get install -y build-essential python3

# 删除旧的 node_modules 并重新安装
cd ~/lk-slc
rm -rf node_modules package-lock.json
npm install

# 启动服务器
npm start
```

**验证**:
```bash
gcc --version  # 应显示 gcc 版本
python3 --version  # 应显示 Python 3.x
```

---

### 问题 2: Node.js 版本过低

**错误信息**:
```
Error: This application requires Node.js v22 or higher
```

**解决方案**:

**Ubuntu/Debian**:
```bash
# 卸载旧版本
sudo apt-get remove nodejs npm

# 安装 Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证版本
node --version
```

**使用 nvm (推荐)**:
```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新加载配置
source ~/.bashrc

# 安装并使用 Node.js 22
nvm install 22
nvm use 22
nvm alias default 22  # 设置为默认版本
```

---

### 问题 3: npm install 卡住或超时

**可能原因**: npm 默认源速度慢或网络问题。

**解决方案**:

```bash
# 切换到国内镜像源（中国大陆用户）
npm config set registry https://registry.npmmirror.com

# 清除缓存
npm cache clean --force

# 重新安装
rm -rf node_modules package-lock.json
npm install
```

---

## 网络和防火墙问题

### 问题 4: 局域网设备无法访问服务器

**症状**: 本机可以访问 `http://localhost:3030`，但局域网其他设备无法访问 `http://IP:3030`

**可能原因**:
1. 防火墙阻止 3030 端口
2. 服务器绑定到 `127.0.0.1` 而非 `0.0.0.0`
3. 路由器启用了 AP 隔离

**解决方案**:

**1. 检查服务器监听地址**:
```bash
# 查看服务器是否监听 0.0.0.0:3030
sudo netstat -tlnp | grep 3030

# 应显示:
# tcp6  0  0  :::3030  :::*  LISTEN  <PID>/node

# 如果显示 127.0.0.1:3030，需要修改 .env 文件:
echo "HOST=0.0.0.0" >> .env
pm2 restart chat-server
```

**2. 开放防火墙端口**:

**Ubuntu 防火墙**:
```bash
sudo ufw allow 3030/tcp
sudo ufw reload
sudo ufw status  # 确认规则已添加
```

**CentOS 防火墙**:
```bash
sudo firewall-cmd --permanent --add-port=3030/tcp
sudo firewall-cmd --reload
```

**Windows 防火墙**:
```powershell
# 以管理员运行 PowerShell
netsh advfirewall firewall add rule name="Simple Chat" dir=in action=allow protocol=TCP localport=3030
```

**3. 检查路由器配置**:
- 确保未启用 AP 隔离（无线设备之间隔离）
- 检查是否有访问控制列表（ACL）限制

**4. 测试连接**:
```bash
# 在局域网另一台设备上测试
curl http://SERVER_IP:3030

# 或使用 telnet 测试端口
telnet SERVER_IP 3030
```

---

### 问题 5: 端口被占用

**错误信息**:
```
Error: listen EADDRINUSE: address already in use :::3030
```

**解决方案**:

**找到并终止占用端口的进程**:

**Linux/macOS**:
```bash
# 查找占用 3030 端口的进程
sudo lsof -i :3030

# 或使用 netstat
sudo netstat -tlnp | grep :3030

# 终止进程（替换 <PID> 为实际进程 ID）
kill <PID>

# 或强制终止
kill -9 <PID>
```

**Windows**:
```powershell
# 查找占用端口的进程
netstat -ano | findstr :3030

# 终止进程（替换 <PID> 为实际进程 ID）
taskkill /PID <PID> /F
```

---

## HTTPS 和 SSL 证书问题

### 问题 6: 浏览器显示"混合内容"警告 (Mixed Content)

**症状**:
- 使用 Nginx HTTPS 反向代理后，浏览器显示: "This site has a valid certificate, issued by a trusted authority. However, some parts of the site are not secure."
- 开发者工具显示 WebSocket 连接失败或使用 HTTP 而非 HTTPS

**根本原因**: Socket.io 客户端未自动检测 HTTPS 协议，仍尝试使用 HTTP/WS 连接。

**解决方案**:

此问题已在 v0.1.0 版本修复。如果使用旧版本，请更新代码或手动修改 `public/js/app.js` 第 110-118 行:

```javascript
// 修改前 (旧版本)
function connectSocket() {
  socket = io({
    auth: { token }
  });
}

// 修改后 (新版本)
function connectSocket() {
  socket = io(window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],
    secure: window.location.protocol === 'https:',
    rejectUnauthorized: true
  });
}
```

**验证修复**:
1. 清除浏览器缓存 (Ctrl + Shift + Delete)
2. 重新访问 `https://YOUR_IP:63030`
3. 打开开发者工具 (F12) → Network → WS
4. 应看到 `wss://YOUR_IP:63030/socket.io/...` 连接成功（注意是 **wss** 而非 ws）

**注意**: 如果使用隐身/无痕模式访问正常，但普通模式仍显示警告，这是浏览器缓存问题，清除缓存即可。

---

### 问题 7: Nginx 启动失败（端口被占用）

**错误信息**:
```
nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)
nginx: [emerg] bind() to 0.0.0.0:443 failed (98: Address already in use)
```

**原因**: 系统中已有其他服务（如 Apache）占用 80/443 端口，或 Nginx 默认站点配置监听了这些端口。

**解决方案**:

```bash
# 1. 检查占用 80/443 端口的进程
sudo netstat -tlnp | grep ':80 '
sudo netstat -tlnp | grep ':443'
# 或使用 lsof
sudo lsof -i :80
sudo lsof -i :443

# 2. 如果是 Apache 占用且不需要 Apache
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

---

### 问题 8: WebSocket 连接失败 (`net::ERR_CONNECTION_CLOSED`)

**症状**: 浏览器控制台显示 WebSocket 连接失败，状态码 1006。

**可能原因**:
1. Nginx 配置缺少 WebSocket 支持的 `Upgrade` 和 `Connection` 头
2. 防火墙阻止 HTTPS 端口 (63030)
3. 后端服务器未运行

**解决方案**:

**1. 检查 Nginx 配置**:

确保 `/etc/nginx/sites-available/simple-chat` 包含以下内容:

```nginx
location / {
    proxy_pass http://localhost:3030;
    proxy_http_version 1.1;

    # 必需: WebSocket 支持
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # 传递客户端信息
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

修改后重新加载:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

**2. 检查防火墙**:
```bash
sudo ufw status | grep 63030
# 应显示: 63030/tcp  ALLOW  Anywhere

# 如果没有，添加规则
sudo ufw allow 63030/tcp
sudo ufw reload
```

**3. 检查后端服务器**:
```bash
# 确认服务器运行
pm2 status

# 确认 3030 端口监听
sudo netstat -tlnp | grep 3030

# 如果未运行，启动服务器
pm2 start server/index.js --name chat-server
```

**4. 查看 Nginx 错误日志**:
```bash
sudo tail -f /var/log/nginx/chat_error.log
```

---

### 问题 9: 502 Bad Gateway

**原因**: Nginx 无法连接到后端服务器 (http://localhost:3030)

**解决方案**:

```bash
# 检查聊天服务器是否运行
pm2 status

# 检查 3030 端口是否监听
sudo netstat -tlnp | grep 3030

# 如果未运行，启动服务器
pm2 start server/index.js --name chat-server

# 如果已运行，重启服务器
pm2 restart chat-server

# 查看服务器日志
pm2 logs chat-server
```

---

### 问题 10: 自签名证书浏览器警告

**症状**: 浏览器显示 "您的连接不是私密连接" 或 "NET::ERR_CERT_AUTHORITY_INVALID"

**原因**: 自签名证书未被浏览器信任。

**解决方案**:

**临时方案（测试环境）**:
1. 点击浏览器中的「高级」或 "Advanced"
2. 点击「继续访问」或 "Proceed to site"

**永久方案（生产环境）**:

使用 Let's Encrypt 免费证书:

```bash
# 安装 Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 获取证书（需要域名）
sudo certbot --nginx -d your-domain.com

# 证书会自动配置到 Nginx 并自动续期
```

---

### 问题 11: 证书过期

**症状**: 浏览器显示证书过期警告

**解决方案**:

**自签名证书**: 重新生成证书

```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/chat.key \
  -out /etc/nginx/ssl/chat.crt

sudo chmod 600 /etc/nginx/ssl/chat.key
sudo chmod 644 /etc/nginx/ssl/chat.crt

sudo systemctl reload nginx
```

**Let's Encrypt 证书**: Certbot 会自动续期，但如果失败:

```bash
# 手动续期
sudo certbot renew

# 检查续期状态
sudo certbot certificates
```

---

## 数据库问题

### 问题 12: 数据库文件损坏

**症状**:
- 服务器启动失败，报 SQLite 错误
- 无法正常读取用户或消息数据

**解决方案**:

**1. 尝试修复数据库**:

```bash
cd ~/lk-slc

# 备份损坏的数据库
cp data/chat.db data/chat-corrupted-$(date +%Y%m%d).db

# 尝试使用 SQLite 修复
sqlite3 data/chat.db "PRAGMA integrity_check;"

# 如果有错误，尝试导出并重建
sqlite3 data/chat.db ".dump" | sqlite3 data/chat-repaired.db
mv data/chat.db data/chat-old.db
mv data/chat-repaired.db data/chat.db

# 重启服务器
pm2 restart chat-server
```

**2. 如果无法修复，删除并重新初始化**:

```bash
# 备份旧数据（即使损坏也保留）
cp data/chat.db data/chat-backup-$(date +%Y%m%d).db

# 删除数据库
rm data/chat.db

# 重启服务器会自动创建新数据库
pm2 restart chat-server
```

**注意**: 删除数据库会丢失所有用户、消息和房间数据。

---

### 问题 13: 数据库锁定错误 (`SQLITE_BUSY`)

**症状**:
```
Error: SQLITE_BUSY: database is locked
```

**原因**: 多个进程同时访问数据库，或有僵尸进程未释放数据库连接。

**解决方案**:

```bash
# 检查是否有多个 Node.js 进程运行
ps aux | grep node

# 停止所有 PM2 管理的进程
pm2 stop all

# 如果有其他 Node.js 进程，手动终止
kill <PID>

# 重启服务器
pm2 start chat-server
```

---

## Bot 问题

### 问题 14: Bot 无法登录

**症状**: Bot 启动后显示登录失败或连接超时

**可能原因**:
1. `bots/gpt-bot/.env` 配置错误
2. 服务器 URL 错误（HTTP/HTTPS 不匹配）

**解决方案**:

**1. 检查配置文件**:

```bash
cat bots/gpt-bot/.env

# 确认以下配置正确:
# SERVER_URL=http://localhost:3030  # 本地部署
# SERVER_URL=https://your-domain.com:63030  # HTTPS 部署
# BOT_PASSWORD=your-bot-password
# FOUNDRY_ENDPOINT=...
# FOUNDRY_API_KEY=...
```

> Bot 用户名由目录名决定（`gpt-bot`），无需在 .env 中配置。首次启动自动注册。

**2. 测试服务器连接**:

```bash
# 测试 HTTP 连接
curl http://localhost:3030

# 测试 HTTPS 连接
curl -k https://YOUR_IP:63030
```

**3. 查看 Bot 日志**:

```bash
# 直接运行查看详细日志
node bots/gpt-bot/index.js

# 如果使用 PM2
pm2 logs gpt-bot
```

---

### 问题 15: Bot 连接 HTTPS 服务器失败 (证书验证错误)

**症状**:
```
Error: unable to verify the first certificate
Error: self signed certificate
```

**原因**: Bot 连接 HTTPS 服务器时，自签名证书验证失败。

**解决方案**:

**临时方案（测试环境）**: 在 `bots/gpt-bot/.env` 中设置:

```env
REJECT_UNAUTHORIZED=false
```

**注意**: 仅用于测试环境，生产环境建议使用 Let's Encrypt 证书。

**永久方案（生产环境）**: 使用受信任的 SSL 证书

```bash
# 使用 Let's Encrypt 获取证书
sudo certbot --nginx -d your-domain.com

# 修改 bots/gpt-bot/.env
SERVER_URL=https://your-domain.com:63030
```

---

## PM2 和进程管理问题

### 问题 16: PM2 无法启动服务

**症状**:
```
pm2 start server/index.js --name chat-server
[PM2] Process chat-server errored
```

**解决方案**:

**1. 查看详细错误日志**:

```bash
pm2 logs chat-server
```

**2. 直接运行脚本排查**:

```bash
cd ~/lk-slc
node server/index.js

# 查看是否有明确的错误信息
```

**3. 常见原因和解决**:

- **端口被占用**: 参考 [问题 5](#问题-5-端口被占用)
- **依赖缺失**: 运行 `npm install`
- **数据库问题**: 参考 [数据库问题](#数据库问题) 章节

---

### 问题 17: PM2 开机自启失败

**症状**: 重启服务器后，聊天服务未自动启动

**解决方案**:

```bash
# 重新配置 PM2 开机自启
pm2 startup

# 执行输出的命令（通常需要 sudo）
# 例如: sudo env PATH=...

# 保存当前进程列表
pm2 save

# 验证配置
sudo systemctl status pm2-$(whoami)
```

---

### 问题 18: PM2 日志过大占用磁盘空间

**症状**: `~/.pm2/logs/` 目录占用数 GB 空间

**解决方案**:

**1. 清理旧日志**:

```bash
pm2 flush  # 清空所有日志
```

**2. 配置日志轮转**:

创建 `pm2-logrotate` 配置:

```bash
pm2 install pm2-logrotate

# 配置最大日志大小 (10MB)
pm2 set pm2-logrotate:max_size 10M

# 配置保留日志数量
pm2 set pm2-logrotate:retain 3

# 配置日志压缩
pm2 set pm2-logrotate:compress true
```

---

## 其他问题

### 问题 19: 消息未实时更新

**症状**: 发送消息后，其他用户需要刷新页面才能看到

**可能原因**:
1. WebSocket 连接断开
2. 浏览器兼容性问题
3. 网络不稳定

**解决方案**:

**1. 检查 WebSocket 连接状态**:

- 打开浏览器开发者工具 (F12)
- Console 标签查看是否有连接错误
- Network 标签 → WS 筛选，查看 WebSocket 连接状态

**2. 刷新页面重新连接**:

```javascript
// 浏览器会自动重连，或手动刷新页面 (F5)
```

**3. 检查服务器日志**:

```bash
pm2 logs chat-server

# 查看是否有错误或异常断开
```

---

### 问题 20: 多设备登录冲突

**症状**: 同一账号在多个设备登录后，部分设备无法接收消息

**原因**: 当前系统只保存最后一个 Socket 连接，旧设备

被覆盖。

**当前状态**: 这是已知限制，系统目前不支持多设备同时在线。

**临时方案**: 每个设备使用不同的账号。

**未来改进**: 计划支持多设备同时在线（多 Socket 连接映射）。

---

## 常用诊断命令

### 检查服务状态

```bash
# PM2 进程状态
pm2 status

# 服务器端口监听
sudo netstat -tlnp | grep 3030
sudo netstat -tlnp | grep 63030

# Nginx 状态
sudo systemctl status nginx

# 防火墙状态
sudo ufw status
```

### 查看日志

```bash
# PM2 日志
pm2 logs chat-server
pm2 logs gpt-bot

# Nginx 日志
sudo tail -f /var/log/nginx/chat_access.log
sudo tail -f /var/log/nginx/chat_error.log

# 系统日志
sudo journalctl -u nginx -f
```

### 网络诊断

```bash
# 测试端口连通性
telnet localhost 3030
curl http://localhost:3030

# 测试 HTTPS 连接
curl -k https://YOUR_IP:63030

# 查看网络连接
sudo netstat -anp | grep 3030
```

---

## 获取帮助

如果以上方案无法解决问题，请前往以下渠道获取帮助:

- **GitHub Issues**: https://github.com/Kai-Cloud/lk-slc/issues
- **查看部署指南**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **查看项目文档**: [README.md](README.md)

提交 Issue 时，请提供以下信息:
1. 操作系统和版本 (e.g., Ubuntu 22.04)
2. Node.js 版本 (`node --version`)
3. 完整错误日志
4. 已尝试的解决方案
5. 相关配置文件内容（隐藏敏感信息）
