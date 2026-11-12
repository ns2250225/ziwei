import type { AiErrorKind, ApiConfig, ChatMessage, ChatResult, StreamCallbacks } from '@/types/ai'

export class AiError extends Error {
  kind: AiErrorKind
  status: number
  detail: string
  constructor(kind: AiErrorKind, message: string, status = 0, detail = '') {
    super(message)
    this.kind = kind
    this.status = status
    this.detail = detail
  }
}

/** 根据 URL 模式解析实际请求地址，避免重复拼接 /v1/chat/completions */
export function resolveEndpoint(cfg: Pick<ApiConfig, 'url' | 'urlMode'>): string {
  const raw = (cfg.url || '').trim()
  if (!raw) return ''
  if (cfg.urlMode === 'full') return raw
  const base = raw.replace(/\/+$/, '')
  if (/\/chat\/completions$/i.test(base)) return base
  if (/\/v\d+[a-z]*$/i.test(base)) return `${base}/chat/completions`
  return `${base}/v1/chat/completions`
}

function parseExtraHeaders(s: string): Record<string, string> {
  if (!s || !s.trim()) return {}
  try {
    const obj = JSON.parse(s)
    if (obj && typeof obj === 'object') {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(obj)) out[k] = String(v)
      return out
    }
  } catch {
    /* 忽略格式错误 */
  }
  return {}
}

interface BuildOptions {
  stream: boolean
  omitTemperature?: boolean
  omitTopP?: boolean
  maxTokensOverride?: number
}

function buildBody(cfg: ApiConfig, messages: ChatMessage[], opt: BuildOptions): Record<string, unknown> {
  const body: Record<string, unknown> = { model: cfg.model, messages, stream: opt.stream }
  if (cfg.sendTemperature && !opt.omitTemperature) body.temperature = cfg.temperature
  if (cfg.sendTopP && !opt.omitTopP) body.top_p = cfg.topP
  const maxTokens = opt.maxTokensOverride ?? cfg.maxTokens
  if (cfg.tokenParam !== 'none' && maxTokens > 0) body[cfg.tokenParam] = maxTokens
  return body
}

/** 将 HTTP 错误归类为用户可理解的提示 */
export function classifyHttpError(status: number, text: string): AiError {
  let msg = text
  try {
    const j = JSON.parse(text)
    msg = j?.error?.message || j?.message || j?.msg || j?.error || text
    if (typeof msg !== 'string') msg = JSON.stringify(msg)
  } catch {
    /* 非 JSON */
  }
  const lower = (msg || '').toLowerCase()
  const short = (msg || '').slice(0, 500)
  if (
    status !== 401 &&
    status !== 403 &&
    /context.?length|context window|maximum context|too many tokens|too long|reduce the length|exceed.*token|token.*exceed|超出.*(上下文|长度|token)/i.test(lower)
  ) {
    return new AiError('token', `输入或输出超出模型上下文/Token 限制：${short}`, status, text)
  }
  if (status === 401 || status === 403 || /api key|apikey|unauthorized|invalid.*key|authentication/.test(lower)) {
    return new AiError('auth', `API Key 无效或无权限（HTTP ${status}），请检查密钥：${short}`, status, text)
  }
  if (/model/.test(lower) && /(not.*exist|not found|does not|invalid|unknown|unsupported|no such|不存在)/.test(lower)) {
    return new AiError('model', `模型不存在或不可用，请检查模型名称：${short}`, status, text)
  }
  if (status === 400 && /(temperature|top_p|max_tokens|max_completion_tokens|unsupported.*param)/.test(lower)) {
    return new AiError('param', `模型不支持部分参数：${short}`, status, text)
  }
  if (status === 404) {
    return new AiError('url', `接口地址不存在（HTTP 404），请检查 API URL 或模型名称：${short}`, status, text)
  }
  if (status === 429) return new AiError('rate', `请求过于频繁或额度不足（HTTP 429）：${short}`, status, text)
  if (status === 408 || status === 504) return new AiError('timeout', `请求超时（HTTP ${status}），请重试。`, status, text)
  if (status >= 500) return new AiError('server', `服务商服务器错误（HTTP ${status}）：${short}`, status, text)
  return new AiError('unknown', `请求失败（HTTP ${status}）：${short}`, status, text)
}

/** 从 SSE/NDJSON 单条 JSON 中提取增量内容 */
function extractDelta(obj: any): { content: string; reasoning: string; finish: string | null; error?: string } {
  if (obj?.error) {
    const e = obj.error
    return { content: '', reasoning: '', finish: null, error: typeof e === 'string' ? e : e.message || JSON.stringify(e) }
  }
  const choice = obj?.choices?.[0]
  if (choice) {
    const d = choice.delta ?? choice.message ?? {}
    let content = ''
    if (typeof d.content === 'string') content = d.content
    else if (Array.isArray(d.content)) content = d.content.map((p: any) => p?.text ?? '').join('')
    else if (typeof choice.text === 'string') content = choice.text
    const reasoning = d.reasoning_content ?? d.reasoning ?? ''
    return { content, reasoning: typeof reasoning === 'string' ? reasoning : '', finish: choice.finish_reason ?? null }
  }
  // Anthropic 风格 / 其他兼容层
  if (obj?.type === 'content_block_delta' && obj.delta?.text) {
    return { content: obj.delta.text, reasoning: '', finish: null }
  }
  if (obj?.type === 'message_delta' && obj.delta?.stop_reason) {
    return { content: '', reasoning: '', finish: obj.delta.stop_reason === 'max_tokens' ? 'length' : obj.delta.stop_reason }
  }
  // Ollama 风格
  if (obj?.message?.content !== undefined) {
    return { content: obj.message.content || '', reasoning: '', finish: obj.done ? obj.done_reason || 'stop' : null }
  }
  if (typeof obj?.response === 'string') {
    return { content: obj.response, reasoning: '', finish: obj.done ? 'stop' : null }
  }
  return { content: '', reasoning: '', finish: null }
}

export interface ChatRequestOptions extends StreamCallbacks {
  signal?: AbortSignal
  /** 覆盖配置中的 stream 开关 */
  stream?: boolean
  maxTokensOverride?: number
}

async function doRequest(
  cfg: ApiConfig,
  messages: ChatMessage[],
  opts: ChatRequestOptions,
  build: BuildOptions,
): Promise<ChatResult> {
  const endpoint = resolveEndpoint(cfg)
  if (!endpoint) throw new AiError('url', '未配置 API URL，请前往 API 设置。')
  try {
    new URL(endpoint)
  } catch {
    throw new AiError('url', `API URL 格式错误：${endpoint}`)
  }
  if (!cfg.model) throw new AiError('model', '未配置模型名称（Model），请前往 API 设置。')

  const controller = new AbortController()
  let timedOut = false
  const onAbort = () => controller.abort()
  opts.signal?.addEventListener('abort', onAbort)
  let timer: ReturnType<typeof setTimeout> | null = null
  const resetTimer = () => {
    if (!cfg.timeout || cfg.timeout <= 0) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, cfg.timeout * 1000)
  }
  resetTimer()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: build.stream ? 'text/event-stream, application/json' : 'application/json',
    ...parseExtraHeaders(cfg.extraHeaders),
  }
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`

  let content = ''
  let reasoning = ''
  let finish: string | null = null

  try {
    let res: Response
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildBody(cfg, messages, build)),
        signal: controller.signal,
      })
    } catch (e) {
      if (controller.signal.aborted) throw e
      throw new AiError(
        'cors',
        '网络请求失败：可能是 API 服务未开放浏览器跨域（CORS）、URL 错误或网络不可达。请确认服务商允许浏览器直接调用，或使用兼容代理。',
      )
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw classifyHttpError(res.status, text)
    }
    resetTimer()
    const ctype = res.headers.get('content-type') || ''
    const isStream = build.stream && res.body && !ctype.includes('application/json')

    if (!isStream) {
      const text = await res.text()
      let obj: any
      try {
        obj = JSON.parse(text)
      } catch {
        // 有些服务即使 content-type 不正确也返回 SSE
        if (text.includes('data:')) return parseSseText(text, opts)
        throw new AiError('unknown', `无法解析接口响应：${text.slice(0, 300)}`)
      }
      const r = extractDelta(obj)
      if (r.error) throw classifyHttpError(200, JSON.stringify({ error: { message: r.error } }))
      content = r.content
      reasoning = r.reasoning
      finish = r.finish
      if (content) opts.onDelta?.(content, content)
      if (reasoning) opts.onReasoning?.(reasoning)
    } else {
      const reader = res.body!.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let done = false
      const handleLine = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:') || trimmed.startsWith('id:') || trimmed.startsWith('retry:')) return
        const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
        if (payload === '[DONE]') {
          done = true
          return
        }
        let obj: any
        try {
          obj = JSON.parse(payload)
        } catch {
          return
        }
        const r = extractDelta(obj)
        if (r.error) throw new AiError('server', `模型返回错误：${r.error}`)
        if (r.reasoning) {
          reasoning += r.reasoning
          opts.onReasoning?.(r.reasoning)
        }
        if (r.content) {
          content += r.content
          opts.onDelta?.(r.content, content)
        }
        if (r.finish) finish = r.finish
      }
      while (!done) {
        const { value, done: rdone } = await reader.read()
        if (rdone) break
        resetTimer()
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''
        for (const l of lines) handleLine(l)
      }
      buffer += decoder.decode()
      if (buffer) handleLine(buffer)
      try {
        reader.cancel().catch(() => undefined)
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    if (controller.signal.aborted) {
      if (timedOut) {
        throw Object.assign(new AiError('timeout', '请求超时，已保存已生成内容，可点击重试。'), { partial: content })
      }
      throw Object.assign(new AiError('aborted', '已停止生成。'), { partial: content })
    }
    if (e instanceof AiError) throw Object.assign(e, { partial: content })
    throw Object.assign(new AiError('unknown', `模型中断：${(e as Error).message}`), { partial: content })
  } finally {
    if (timer) clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
  }

  return { content, reasoning, finishReason: finish, truncated: finish === 'length' || finish === 'max_tokens' }
}

function parseSseText(text: string, opts: ChatRequestOptions): ChatResult {
  let content = ''
  let reasoning = ''
  let finish: string | null = null
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t.startsWith('data:')) continue
    const p = t.slice(5).trim()
    if (p === '[DONE]') break
    try {
      const r = extractDelta(JSON.parse(p))
      content += r.content
      reasoning += r.reasoning
      if (r.finish) finish = r.finish
    } catch {
      /* ignore */
    }
  }
  if (content) opts.onDelta?.(content, content)
  return { content, reasoning, finishReason: finish, truncated: finish === 'length' }
}

/**
 * 发送对话请求。若模型不支持 temperature / top_p 参数，会自动去除后重试一次。
 */
export async function chatCompletion(
  cfg: ApiConfig,
  messages: ChatMessage[],
  opts: ChatRequestOptions = {},
): Promise<ChatResult> {
  const stream = opts.stream ?? cfg.stream
  try {
    return await doRequest(cfg, messages, opts, { stream, maxTokensOverride: opts.maxTokensOverride })
  } catch (e) {
    if (e instanceof AiError && e.kind === 'param' && !(e as any).partial) {
      return await doRequest(cfg, messages, opts, {
        stream,
        omitTemperature: true,
        omitTopP: true,
        maxTokensOverride: opts.maxTokensOverride,
      })
    }
    throw e
  }
}

export interface TestResult {
  ok: boolean
  endpoint: string
  latency: number
  content: string
  error?: string
  kind?: AiErrorKind
}

/** API 连接测试：验证 URL、Key、模型 */
export async function testConnection(cfg: ApiConfig, signal?: AbortSignal): Promise<TestResult> {
  const endpoint = resolveEndpoint(cfg)
  const start = performance.now()
  try {
    const r = await chatCompletion(
      { ...cfg, timeout: cfg.timeout > 0 ? Math.min(cfg.timeout, 60) : 60 },
      [
        { role: 'system', content: '你是一个连接测试助手。' },
        { role: 'user', content: '请用一句中文回复：连接成功。并说明你的模型名称。' },
      ],
      { signal, maxTokensOverride: 200 },
    )
    return { ok: true, endpoint, latency: Math.round(performance.now() - start), content: r.content || r.reasoning || '（模型返回为空）' }
  } catch (e) {
    const err = e as AiError
    return {
      ok: false,
      endpoint,
      latency: Math.round(performance.now() - start),
      content: (e as any).partial || '',
      error: err.message,
      kind: err.kind,
    }
  }
}

export function errorHint(kind?: AiErrorKind): string {
  switch (kind) {
    case 'url':
      return '请检查 API URL：完整地址模式需填写到 /chat/completions，Base URL 模式只需填写到域名或 /v1。'
    case 'auth':
      return '请检查 API Key 是否正确、是否过期、是否有该模型的调用权限。'
    case 'model':
      return '请检查模型名称是否与服务商文档一致（区分大小写）。'
    case 'cors':
      return '浏览器直连需要服务商开放 CORS。若服务商不支持，请使用支持跨域的兼容代理（如自建 One API / New API）。'
    case 'timeout':
      return '请求超时，可在 API 设置中调大超时时间后重试。'
    case 'token':
      return '内容超过模型上下文限制，建议使用分阶段分析，或调小 Max Tokens / 更换长上下文模型。'
    case 'rate':
      return '请求频率或额度受限，请稍后重试或检查账户余额。'
    case 'param':
      return '可在 API 设置中关闭“发送 Temperature / Top P”，或更换 Token 参数名。'
    default:
      return ''
  }
}
