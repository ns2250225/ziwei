import markdownit from 'markdown-it'
import type { MarkdownIt, RendererRule, Token } from 'markdown-it'
import hljs from 'highlight.js/lib/common'

export interface TocItem {
  id: string
  level: number
  text: string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function createMd(): MarkdownIt {
  const md: MarkdownIt = markdownit({
    html: false,
    linkify: true,
    breaks: true,
    typographer: false,
    highlight(code: string, lang: string): string {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang, ignoreIllegals: true }).value}</code></pre>`
        } catch {
          /* 降级 */
        }
      }
      return `<pre class="hljs"><code>${escapeHtml(code)}</code></pre>`
    },
  })
  // 表格包一层以便横向滚动
  md.renderer.rules.table_open = () => '<div class="md-table-wrap"><table>'
  md.renderer.rules.table_close = () => '</table></div>'
  // 外链新窗口打开
  const fallback: RendererRule = (tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options)
  const defaultLinkOpen: RendererRule = md.renderer.rules.link_open || fallback
  md.renderer.rules.link_open = (tokens: Token[], idx: number, options, env, self) => {
    tokens[idx].attrSet('target', '_blank')
    tokens[idx].attrSet('rel', 'noopener noreferrer')
    return defaultLinkOpen(tokens, idx, options, env, self)
  }
  return md
}

const md = createMd()

/**
 * 渲染 Markdown，并为标题添加锚点 id。
 * idPrefix 用于在同一页面多段内容中区分锚点。
 * 解析失败时降级为原始文本。
 */
export function renderMarkdown(src: string, idPrefix = 'h'): { html: string; toc: TocItem[]; failed: boolean } {
  const toc: TocItem[] = []
  try {
    const env = {}
    const tokens = md.parse(src || '', env)
    let n = 0
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]
      if (t.type === 'heading_open') {
        const level = Number(t.tag.slice(1))
        const inline = tokens[i + 1]
        const text = inline?.children?.map((c: Token) => c.content).join('') ?? inline?.content ?? ''
        const id = `${idPrefix}-${n++}`
        t.attrSet('id', id)
        toc.push({ id, level, text: text.trim() })
      }
    }
    const html = md.renderer.render(tokens, md.options, env)
    return { html, toc, failed: false }
  } catch {
    return { html: `<pre class="md-fallback">${escapeHtml(src)}</pre>`, toc, failed: true }
  }
}

export function renderMarkdownSimple(src: string): string {
  try {
    return md.render(src || '')
  } catch {
    return `<pre class="md-fallback">${escapeHtml(src)}</pre>`
  }
}
