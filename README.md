# geo-news-bot

Cloudflare Workers 地缘新闻机器人 + **网页控制面板**：

1. 面板里粘贴 Bot Token 添加机器人（自动配置 Webhook）  
2. 把机器人拉进 Telegram 频道并设为**管理员**（勾选发布消息）  
3. **自动绑定频道**，定时把美/伊/迪拜相关新闻用 Workers AI 译成中文后推送  

## 架构

```
控制面板 (/)
  → 添加 Bot → setWebhook
  → 拉进频道设管理员 → my_chat_member 自动绑定

Cron 每 10 分钟
  → RSS → 关键词过滤 → Workers AI 中文摘要
  → 发送到所有「已绑定且启用」的频道
```

## 部署

```bash
npm install
npx wrangler login
npx wrangler d1 create geo-news-bot
```

把返回的 `database_id` 写入 `wrangler.jsonc` → `d1_databases[0].database_id`。

```bash
npm run db:migrate:remote
npx wrangler secret put PANEL_PASSWORD   # 控制面板登录密码
# 可选
npx wrangler secret put CRON_SECRET
npm run deploy
```

打开：`https://geo-news-bot.<子域>.workers.dev/`

## 面板使用

1. 用 `PANEL_PASSWORD` 登录  
2. **添加机器人**：粘贴 @BotFather 的 Token → 点「添加并启用」  
3. Telegram 里：频道 → 管理员 → 添加该机器人 → 勾选 **发布消息**  
4. 回到面板，几秒内「已绑定频道」会出现（页面每 8 秒刷新）  
5. 点「测试发送」确认；或「立即抓取并推送」  

若自动绑定失败：在面板下方填 `@频道用户名` 或 `-100...` 点「手动绑定」。

## 本地调试

```bash
cp .dev.vars.example .dev.vars
# 编辑 PANEL_PASSWORD
npm run db:migrate:local
npm run dev
```

浏览器打开 `http://127.0.0.1:8787/`。  
本地 Webhook 需要公网 URL（如 cloudflared）才能自动绑定；本地可用「手动绑定」。

## 可调变量

| 变量 | 默认 | 含义 |
|------|------|------|
| `AI_MODEL` | `@cf/qwen/qwen3-30b-a3b-fp8` | Workers AI |
| `MAX_ITEMS_PER_RUN` | `12` | 每轮最多分析条数 |
| `MAX_AGE_HOURS` | `24` | 新闻时效 |
| `MIN_URGENCY` | `5` | 紧迫度门槛 |

源列表：`src/sources.ts`。

## 安全说明

- 面板有 Cookie 登录；Bot Token 存在 D1，勿公开 Worker URL 给外人  
- Webhook 带 per-bot `secret_token`  
- 生产环境请使用强 `PANEL_PASSWORD`
