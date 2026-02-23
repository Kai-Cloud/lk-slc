# GPT-4o Bot 使用指南

## 简介

GPT-4o Bot 是一个智能聊天机器人，可以在聊天室中回答用户的问题。

## 配置

### 1. 复制环境变量文件

```bash
cp .env.example .env
```

### 2. 编辑 `.env` 文件

```bash
# 服务器配置
SERVER_URL=http://localhost:3030
# 如果使用 HTTPS，例如: https://your-domain.com:63030

# Bot 认证
BOT_USERNAME=gpt-bot
BOT_PASSWORD=your-secure-password

# SSL 证书验证（用于自签名证书）
REJECT_UNAUTHORIZED=true
# 如果使用自签名证书，设置为: REJECT_UNAUTHORIZED=false

# Foundry GPT-4o 配置
FOUNDRY_ENDPOINT=https://your-endpoint.azure.com/v1/chat/completions
FOUNDRY_API_KEY=your-api-key
```

### 配置说明

#### SERVER_URL
- **HTTP**: `http://localhost:3030`
- **HTTPS（有效证书）**: `https://your-domain.com:63030`
- **HTTPS（自签名证书）**: `https://your-ip:63030`（需要设置 `REJECT_UNAUTHORIZED=false`）

#### REJECT_UNAUTHORIZED
- **`true`（默认）**: 验证 SSL 证书，适用于生产环境和有效证书
- **`false`**: 忽略证书验证，适用于开发/测试环境的自签名证书

⚠️ **安全警告**:
- 仅在使用自签名证书的开发/测试环境中设置 `REJECT_UNAUTHORIZED=false`
- 生产环境应使用 Let's Encrypt 等颁发的有效证书
- 禁用证书验证会降低安全性，可能导致中间人攻击

## 运行

### 开发模式（前台运行）

```bash
node gpt-bot.js
```

### 生产模式（后台运行，使用 PM2）

```bash
# 启动 bot
pm2 start gpt-bot.js --name gpt-bot

# 查看状态
pm2 status

# 查看日志
pm2 logs gpt-bot

# 停止 bot
pm2 stop gpt-bot

# 重启 bot
pm2 restart gpt-bot
```

## 使用方法

### 群聊中
在消息中 @ 提及 bot：
```
@gpt-bot 什么是人工智能？
```

### 私聊中
直接发送消息，无需 @ 提及：
```
你好，请介绍一下你自己
```

## 故障排除

### 问题：登录失败 - self-signed certificate

**错误信息**:
```
❌ 登录失败: self-signed certificate
```

**解决方法**:
在 `.env` 文件中添加：
```
REJECT_UNAUTHORIZED=false
```

### 问题：连接错误 - ECONNREFUSED

**原因**: 服务器未运行或 URL 配置错误

**解决方法**:
1. 确认服务器正在运行
2. 检查 `SERVER_URL` 配置是否正确
3. 检查防火墙是否允许连接

### 问题：GPT-4o 调用失败

**原因**: Foundry API 配置错误或 API 密钥无效

**解决方法**:
1. 检查 `FOUNDRY_ENDPOINT` 是否正确
2. 检查 `FOUNDRY_API_KEY` 是否有效
3. 确认 API 配额未超限

## 技术细节

### 连接流程

1. Bot 通过 HTTP API 登录获取 token
2. 使用 token 建立 WebSocket 连接
3. 监听聊天消息并响应

### 消息处理

- **群聊**: 仅响应 @ 提及的消息
- **私聊**: 响应所有消息
- **防重复**: 维护已处理消息的 ID 集合
- **心跳**: 每 30 秒发送一次 keepAlive 保持在线状态

### SSL/TLS 配置

当 `REJECT_UNAUTHORIZED=false` 时：
- Axios（HTTP API 登录）使用自定义 `https.Agent` 忽略证书验证
- Socket.io 连接配置 `rejectUnauthorized: false` 忽略证书验证

## 安全建议

1. **使用强密码**: 为 `BOT_PASSWORD` 设置复杂密码
2. **保护 API 密钥**: 不要将 `.env` 文件提交到版本控制
3. **使用有效证书**: 生产环境使用 Let's Encrypt 证书
4. **限制访问**: 配置防火墙仅允许必要的连接
5. **定期更新**: 保持依赖包和 Node.js 版本最新

## 相关文档

- [DEPLOYMENT.md](../DEPLOYMENT.md) - 服务器部署指南
- [README.md](../README.md) - 项目主文档
