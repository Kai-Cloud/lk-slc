# GPT Bot

基于 OpenAI GPT-4o 或 DeepSeek 的智能聊天机器人。

## 快速开始

1. **配置环境变量**

   ```bash
   cp .env.example .env
   ```

   编辑 `.env` 文件，填入你的配置：

   **使用 GPT-4o:**
   ```env
   SERVER_URL=http://localhost:3030
   BOT_PASSWORD=your-secure-password
   FOUNDRY_ENDPOINT=https://your-endpoint.azure.com/v1/chat/completions
   FOUNDRY_API_KEY=your-api-key
   ```

   **使用 DeepSeek:**
   ```env
   SERVER_URL=http://localhost:3030
   BOT_PASSWORD=your-secure-password
   FOUNDRY_ENDPOINT=https://kaili-mcka2rzi-eastus2.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview
   FOUNDRY_API_KEY=your-api-key
   MODEL_NAME=DeepSeek-V3-0324
   ```

   > 注意：Bot 用户名将自动使用文件夹名称（本例中为 `gpt-bot`）

2. **安装依赖** (如果是第一次运行)

   ```bash
   cd ../..  # 返回项目根目录
   npm install
   ```

3. **启动 Bot**

   ```bash
   node bots/gpt-bot/index.js
   ```

## 功能特性

- ✅ 自动使用文件夹名称作为 Bot 用户名
- ✅ 支持群聊 @ 提及触发回复
- ✅ 支持私聊直接对话
- ✅ 支持多种 AI 模型（GPT-4o、DeepSeek 等）
- ✅ 自动重连机制
- ✅ 支持自签名 SSL 证书

## 使用方法

### 群聊中使用

在聊天室中 @ 提及 Bot：

```
@gpt-bot 你好，请介绍一下自己
```

### 私聊中使用

创建与 Bot 的私聊房间，直接发送消息即可，无需 @ 提及。

## 创建新 Bot

如果你想创建一个新的 Bot（比如 `claude-bot`），只需：

1. **复制整个文件夹**

   ```bash
   cp -r bots/gpt-bot bots/claude-bot
   ```

2. **修改配置**

   编辑 `bots/claude-bot/.env`，配置新 Bot 的密码和 API 设置。

3. **修改代码**（如果需要）

   编辑 `bots/claude-bot/index.js`，根据你的需求修改 Bot 逻辑。

   Bot 用户名会自动变成 `claude-bot`（文件夹名称）。

4. **启动新 Bot**

   ```bash
   node bots/claude-bot/index.js
   ```

## 配置说明

### 必需配置

- `BOT_PASSWORD`: Bot 登录密码（首次登录会自动注册）
- `FOUNDRY_ENDPOINT`: AI API 端点
- `FOUNDRY_API_KEY`: AI API 密钥

### 可选配置

- `SERVER_URL`: 聊天服务器地址（默认：`http://localhost:3030`）
- `MODEL_NAME`: AI 模型名称（例如：`DeepSeek-V3-0324`，部分模型需要指定）
- `REJECT_UNAUTHORIZED`: SSL 证书验证（默认：`true`，如果使用自签名证书，设为 `false`）

## 注意事项

1. **Bot 用户名规则**：文件夹名称会作为 Bot 用户名，请确保符合用户名规范（字母、数字、中文、下划线、横杠，最多 10 个字符）
2. **首次启动**：Bot 会自动注册账号，请确保设置了安全的密码
3. **SSL 证书**：如果你的服务器使用自签名证书，请在 `.env` 中设置 `REJECT_UNAUTHORIZED=false`
4. **API 密钥安全**：不要将 `.env` 文件提交到 Git 仓库

## 文件说明

- `index.js`: Bot 主程序
- `.env.example`: 环境变量配置模板
- `.env`: 实际环境变量配置（不提交到 Git）
- `README.md`: 本说明文档
