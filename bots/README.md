# Bots 目录

这个目录包含聊天机器人。每个 Bot 都在独立的文件夹中，包含其代码和配置。

## 可用的 Bots

### [gpt-bot](./gpt-bot/)
基于 GPT-4o 的智能聊天机器人。

**查看完整文档**: [gpt-bot/README.md](./gpt-bot/README.md)

## 创建新 Bot

要创建一个新的 Bot，只需复制现有 Bot 的文件夹：

```bash
# 复制 gpt-bot 文件夹
cp -r gpt-bot my-new-bot

# 编辑配置文件
cd my-new-bot
cp .env.example .env
# 编辑 .env 文件设置密码和 API 配置

# 启动新 Bot
node index.js
```

Bot 的用户名会自动使用文件夹名称（如 `my-new-bot`）。

## 文件结构

每个 Bot 文件夹应包含：
- `index.js` - Bot 主程序
- `.env.example` - 环境变量配置模板
- `.env` - 实际配置（不提交到 Git）
- `README.md` - Bot 说明文档

## 更多信息

查看各个 Bot 文件夹中的 README.md 了解详细配置和使用说明。
