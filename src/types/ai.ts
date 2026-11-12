export type UrlMode = 'full' | 'base'
export type TokenParam = 'max_tokens' | 'max_completion_tokens' | 'none'

export interface ApiConfig {
  id: string
  name: string
  url: string
  /** full：完整接口地址；base：Base URL 自动补全 /v1/chat/completions */
  urlMode: UrlMode
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  topP: number
  stream: boolean
  /** 是否发送 temperature（部分模型不支持自定义） */
  sendTemperature: boolean
  /** 是否发送 top_p */
  sendTopP: boolean
  /** Token 参数名差异 */
  tokenParam: TokenParam
  /** 请求超时（秒），0 表示不限制 */
  timeout: number
  /** 额外请求头（JSON 字符串，可选） */
  extraHeaders: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiErrorKind =
  | 'url'
  | 'auth'
  | 'model'
  | 'cors'
  | 'timeout'
  | 'token'
  | 'rate'
  | 'server'
  | 'aborted'
  | 'param'
  | 'unknown'

export interface ChatResult {
  content: string
  reasoning: string
  finishReason: string | null
  /** 是否因输出长度上限被截断 */
  truncated: boolean
}

export interface StreamCallbacks {
  onDelta?: (delta: string, full: string) => void
  onReasoning?: (delta: string) => void
}
