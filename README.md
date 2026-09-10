# 今晚打烊 · 自部署版

用你自己的阿里云百炼额度跑 AI 周报。测试者不需要任何账号，打开网址就能用，不会看到任何授权弹窗。

## 目录

```
deploy/
  index.html                  整个 app，单文件，无依赖
  api/chat/completions.js     百炼转发，Key 留在服务端
```

## 部署到 Vercel

1. 把 `deploy/` 推到一个 GitHub 仓库。
2. 在 Vercel 里 New Project，import 这个仓库，Framework Preset 选 Other，其余保持默认。
3. Settings → Environment Variables，新增一条：

   | Name | Value |
   |---|---|
   | `DASHSCOPE_API_KEY` | 百炼控制台里的 API Key |

4. Deploy，拿到域名。

## 页面上的一次性配置

打开部署好的网址 → 底部「总结」→ 面板底部「模型设置」：

- 通道选 **阿里云百炼**
- 接口地址填 `/api`
- 模型填 `qwen3.8-27b`
- API Key **留空**（Key 在服务端，前端不需要）
- 点保存

**这一步已经替你做好了。** 本目录的 `index.html` 里 `defaultAI()` 已改成默认走 `/api`，任何人打开都直接用你的百炼额度，不需要在页面上配置。

代价是这份 `index.html` 必须配合转发一起部署才有 AI。直接双击本地文件打开的话，`/api` 无处可去，页面会提示请求发不出去并退回本机统计，流程本身照常可用。要在本地也跑通，用 `vercel dev` 起服务。

## 转发接口做了什么限制

- 只接受 POST
- 模型白名单：qwen3.8-27b / qwen3.7-flash-2026-07-15 / qwen-turbo / qwen-plus，传别的一律按 qwen3.8-27b 处理
- 单次请求正文上限 6000 字符
- 输出上限 500 tokens
- 参数逐档降级：qwen3 系列自动补 enable_thinking=false，上游若以 400 拒绝就依次去掉 response_format 再重试

转发接口是公开的，做小范围用户测试没问题。要发到公开渠道，再加限流或来源校验。

## 每次周报大概消耗

| 项 | 量级 |
|---|---|
| 输入 | 600 到 900 tokens |
| 输出 | 150 tokens 以内 |

一个测试者点几次周报的花费可以忽略。具体单价看百炼控制台，新账号通常还有免费额度。

## 不用 Vercel 的话

任何能跑一个 serverless 函数的免费平台都行，Netlify Functions、Cloudflare Workers 都可以，把 `api/chat/completions.js` 换成对应写法即可，页面那边不用动。

纯静态托管（GitHub Pages、OSS）跑不了转发。硬要用的话只能让页面直连百炼，那样 Key 会暴露在前端，而且大概率过不了 CORS，不建议。
