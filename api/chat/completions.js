// 阿里云百炼转发。API Key 留在服务端，前端拿不到。
// 部署到 Vercel 后，这个文件对应的地址是 /api/chat/completions，
// 页面「模型设置」里的接口地址填 /api 即可，Key 那栏留空。

const UPSTREAM = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

// 只允许这几个模型，避免转发接口被人当免费通道刷贵的
const ALLOWED_MODELS = ["qwen3.8-27b", "qwen3.7-flash-2026-07-15", "qwen-turbo", "qwen-plus"];
const DEFAULT_MODEL = "qwen3.8-27b";
const MAX_CHARS = 6000;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "只接受 POST" } });
    return;
  }

  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) {
    res.status(500).json({ error: { message: "服务端没有配置 DASHSCOPE_API_KEY" } });
    return;
  }

  const body = req.body || {};
  const model = ALLOWED_MODELS.indexOf(body.model) >= 0 ? body.model : DEFAULT_MODEL;
  const messages = Array.isArray(body.messages) ? body.messages : [];

  const total = messages.reduce((n, m) => n + String((m && m.content) || "").length, 0);
  if (!messages.length || total > MAX_CHARS) {
    res.status(400).json({ error: { message: "请求内容为空或过长" } });
    return;
  }

  const base = {
    model: model,
    messages: messages,
    temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
    max_tokens: 500
  };

  // 从最完整的参数开始，被上游以 400 拒绝就退一档重试。
  // qwen3 系列在兼容模式下非流式调用需要 enable_thinking=false，
  // 部分模型又不认 response_format，逐档降级比猜测哪个能用可靠。
  const variants = [];
  const full = Object.assign({}, base);
  if (/^qwen3/i.test(model)) full.enable_thinking = false;
  if (body.response_format) full.response_format = body.response_format;
  variants.push(full);
  if (full.response_format) {
    const noFormat = Object.assign({}, full);
    delete noFormat.response_format;
    variants.push(noFormat);
  }
  variants.push(base);

  async function call(p) {
    return fetch(UPSTREAM, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify(p)
    });
  }

  try {
    let r;
    for (let i = 0; i < variants.length; i++) {
      r = await call(variants[i]);
      if (r.status !== 400) break;
    }
    const text = await r.text();
    res.status(r.status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: { message: "上游请求失败：" + String((e && e.message) || e) } });
  }
};
