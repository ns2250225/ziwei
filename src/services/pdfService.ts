import type { ChartData, PalaceData } from '@/types/chart'
import type { ReportRecord } from '@/types/report'
import { renderMarkdown } from '@/utils/markdown'
import { formatDate, safeFileName } from '@/utils/common'
import { BRANCHES, GRID_POS } from './chartAdapter'

/** A4：210mm × 297mm，页边距 12mm */
const MARGIN_MM = [14, 12, 16, 12] as const
const PX_PER_MM = 96 / 25.4
const INNER_WIDTH_PX = Math.floor((210 - MARGIN_MM[1] - MARGIN_MM[3]) * PX_PER_MM)
const INNER_HEIGHT_PX = Math.floor((297 - MARGIN_MM[0] - MARGIN_MM[2]) * PX_PER_MM)
/** 单次渲染的最大高度（约 5 页），避免超出浏览器 canvas 尺寸限制 */
const MAX_CHUNK_PX = INNER_HEIGHT_PX * 5

const PDF_STYLE = `
.pdf-doc{width:${INNER_WIDTH_PX}px;box-sizing:border-box;color:#1f1a17;background:#fff;
  font-family:"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun","STSong","Microsoft YaHei","PingFang SC",serif;
  font-size:13px;line-height:1.85;}
.pdf-doc *{box-sizing:border-box;}
.pdf-doc h1{font-size:22px;color:#7c2d12;margin:0 0 12px;border-bottom:2px solid #b45309;padding-bottom:6px;}
.pdf-doc h2{font-size:18px;color:#7c2d12;margin:18px 0 8px;padding-left:10px;border-left:4px solid #b45309;}
.pdf-doc h3{font-size:15px;color:#92400e;margin:14px 0 6px;}
.pdf-doc h4{font-size:14px;margin:10px 0 4px;}
.pdf-doc p{margin:6px 0;}
.pdf-doc ul,.pdf-doc ol{margin:6px 0;padding-left:22px;}
.pdf-doc li{margin:2px 0;break-inside:avoid;}
.pdf-doc blockquote{margin:8px 0;padding:6px 12px;border-left:3px solid #d6a756;background:#fbf6ec;color:#57452f;break-inside:avoid;}
.pdf-doc table{border-collapse:collapse;width:100%;margin:8px 0;font-size:12px;}
.pdf-doc th,.pdf-doc td{border:1px solid #d8cbb4;padding:4px 6px;vertical-align:top;text-align:left;}
.pdf-doc th{background:#f5ead6;}
.pdf-doc tr{break-inside:avoid;}
.pdf-doc pre{white-space:pre-wrap;word-break:break-all;background:#faf7f2;border:1px solid #eadfcd;padding:8px 10px;font-size:12px;break-inside:avoid;}
.pdf-doc code{font-family:Consolas,"Courier New",monospace;}
.pdf-doc hr{border:none;border-top:1px dashed #d8cbb4;margin:14px 0;}
.pdf-doc .md-table-wrap{width:100%;}
.pdf-doc .keep{break-inside:avoid;}
.pdf-cover{height:${INNER_HEIGHT_PX - 4}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
  border:3px double #b45309;background:radial-gradient(circle at 50% 35%,#fff8ea 0%,#fff 60%);}
.pdf-cover .seal{width:96px;height:96px;border-radius:50%;background:#7c2d12;color:#fcd34d;font-size:40px;display:flex;align-items:center;justify-content:center;margin-bottom:28px;}
.pdf-cover .t1{font-size:34px;color:#7c2d12;letter-spacing:8px;font-weight:700;}
.pdf-cover .t2{font-size:16px;color:#92400e;margin-top:10px;letter-spacing:4px;}
.pdf-cover .who{margin-top:56px;font-size:20px;}
.pdf-cover .meta{margin-top:14px;font-size:13px;color:#57452f;line-height:2;}
.pdf-cover .foot{margin-top:70px;font-size:12px;color:#8a7a66;}
.pdf-info{width:100%;border-collapse:collapse;font-size:12.5px;}
.pdf-info td{border:1px solid #d8cbb4;padding:5px 8px;}
.pdf-info td.k{background:#f5ead6;width:20%;color:#7c2d12;}
.pdf-grid{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,auto);border:2px solid #7c2d12;margin-top:12px;font-size:11px;line-height:1.5;}
.pdf-cell{border:1px solid #c9b48f;padding:4px 5px;min-height:150px;position:relative;}
.pdf-cell .pn{font-weight:700;color:#7c2d12;}
.pdf-cell .gz{position:absolute;right:5px;bottom:3px;color:#8a7a66;}
.pdf-cell .maj{color:#b91c1c;font-weight:700;}
.pdf-cell .min{color:#1d4ed8;}
.pdf-cell .adj{color:#6b7280;font-size:10px;}
.pdf-cell .mut{display:inline-block;background:#b91c1c;color:#fff;border-radius:2px;padding:0 2px;font-size:10px;margin-left:1px;}
.pdf-cell .dec{color:#57452f;font-size:10.5px;margin-top:2px;}
.pdf-center{grid-column:2 / span 2;grid-row:2 / span 2;border:1px solid #c9b48f;padding:10px;background:#fffaf0;font-size:11.5px;}
.pdf-center .nm{font-size:16px;font-weight:700;color:#7c2d12;margin-bottom:4px;}
.pdf-toc li{list-style:none;border-bottom:1px dotted #d8cbb4;padding:4px 0;}
.pdf-disclaimer{border:1px solid #d8cbb4;background:#fbf6ec;padding:14px 16px;font-size:12.5px;}
`

function ensureStyle() {
  if (document.getElementById('pdf-export-style')) return
  const style = document.createElement('style')
  style.id = 'pdf-export-style'
  style.textContent = PDF_STYLE
  document.head.appendChild(style)
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function cellHtml(p: PalaceData): string {
  const [r, c] = GRID_POS[p.branch]
  const star = (s: { name: string; brightness: string; mutagen: string }, cls: string) =>
    `<span class="${cls}">${esc(s.name)}${s.brightness ? `<small>${esc(s.brightness)}</small>` : ''}${s.mutagen ? `<span class="mut">${esc(s.mutagen)}</span>` : ''}</span>`
  return `<div class="pdf-cell" style="grid-row:${r};grid-column:${c}">
    <div>${p.majorStars.map((s) => star(s, 'maj')).join(' ') || '<span class="adj">（空宫）</span>'}</div>
    <div>${p.minorStars.map((s) => star(s, 'min')).join(' ')}</div>
    <div class="adj">${p.adjectiveStars.map((s) => esc(s.name)).join(' ')}</div>
    ${p.selfMutagens.length ? `<div class="adj">自化：${p.selfMutagens.map((m) => esc(m.star + m.mutagen)).join(' ')}</div>` : ''}
    <div class="dec">${p.decadal.startAge}~${p.decadal.endAge}　${esc(p.changsheng12)}</div>
    <div class="pn">${esc(p.name)}${p.isBodyPalace ? '·身' : ''}</div>
    <span class="gz">${esc(p.stem + p.branch)}</span>
  </div>`
}

export function chartGridHtml(chart: ChartData): string {
  const b = chart.basicInfo
  const cells = BRANCHES.map((br) => chart.palaces.find((p) => p.branch === br)).filter(Boolean) as PalaceData[]
  return `<div class="pdf-grid">
    ${cells.map(cellHtml).join('')}
    <div class="pdf-center">
      <div class="nm">${esc(b.name)}（${esc(b.yinYangGender)}）</div>
      <div>公历：${esc(b.solarDate)} ${esc(b.clockTime)}</div>
      ${b.trueSolarTime ? `<div>真太阳时：${esc(b.trueSolarTime)}</div>` : ''}
      <div>农历：${esc(b.lunarDate)} ${esc(b.timeBranch)}</div>
      <div>节气四柱：${esc(b.jieqiPillars)}</div>
      <div>非节气四柱：${esc(b.lunarPillars)}</div>
      <div>五行局：${esc(b.fiveElements)}　命主：${esc(b.lifeMaster)}　身主：${esc(b.bodyMaster)}</div>
      <div>身宫：${esc(b.bodyPalace)}　子年斗君：${esc(b.ziDouJun)}</div>
      <div>生年四化：${b.birthYearMutagens.map((m) => esc(`${m.star}化${m.mutagen}`)).join('、')}</div>
    </div>
  </div>`
}

function infoTableHtml(chart: ChartData): string {
  const b = chart.basicInfo
  const rows: [string, string][] = [
    ['姓名', b.name],
    ['性别', `${b.gender}（${b.yinYangGender}）`],
    ['公历出生', `${b.solarDate}`],
    ['钟表时间', b.clockTime],
    ['真太阳时', b.trueSolarTime ?? '未启用'],
    ['出生地点 / 经度', `${b.location || '—'} / ${b.longitude ?? '—'}`],
    ['农历', `${b.lunarDate} ${b.timeBranch}（${b.timeRange}）`],
    ['节气四柱', b.jieqiPillars],
    ['非节气四柱', b.lunarPillars],
    ['五行局', b.fiveElements],
    ['命主 / 身主', `${b.lifeMaster} / ${b.bodyMaster}`],
    ['命宫 / 身宫', `${b.lifePalaceBranch} / ${b.bodyPalace}（${b.bodyPalaceBranch}）`],
    ['子年斗君', `${b.ziDouJun}（${b.ziDouJunPalace}）`],
    ['生肖 / 星座', `${b.zodiac} / ${b.sign}`],
  ]
  return `<table class="pdf-info">${rows
    .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join('')}</table>`
}

/** 将标题与其后第一个元素包裹，避免标题与正文分离 */
function keepHeadingsWithContent(root: HTMLElement) {
  const heads = Array.from(root.querySelectorAll('h1,h2,h3,h4'))
  for (const h of heads) {
    const next = h.nextElementSibling
    if (!next || /^H[1-4]$/.test(next.tagName) || !h.parentElement) continue
    const wrap = document.createElement('div')
    wrap.className = 'keep'
    h.parentElement.insertBefore(wrap, h)
    wrap.appendChild(h)
    // 大表格不整体包裹，仅包裹较短内容
    if (next.tagName !== 'DIV' || (next as HTMLElement).innerText.length < 600) wrap.appendChild(next)
  }
}

interface Block {
  el: HTMLElement
  newPage: boolean
}

/** 将块按高度分组为若干渲染批次 */
function chunkBlocks(blocks: Block[]): HTMLElement[] {
  const host = document.createElement('div')
  host.style.cssText = `position:absolute;left:-20000px;top:0;width:${INNER_WIDTH_PX}px;`
  const measure = document.createElement('div')
  measure.className = 'pdf-doc'
  host.appendChild(measure)
  document.body.appendChild(host)
  const chunks: HTMLElement[] = []
  let current: HTMLElement | null = null
  let height = 0
  try {
    for (const b of blocks) {
      measure.innerHTML = ''
      measure.appendChild(b.el)
      const h = measure.getBoundingClientRect().height
      measure.removeChild(b.el)
      if (!current || b.newPage || height + h > MAX_CHUNK_PX) {
        current = document.createElement('div')
        current.className = 'pdf-doc'
        chunks.push(current)
        height = 0
      }
      current.appendChild(b.el)
      height += h
    }
  } finally {
    host.remove()
  }
  return chunks
}

function htmlToBlocks(html: string, firstNewPage: boolean): Block[] {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  keepHeadingsWithContent(tmp)
  return Array.from(tmp.children).map((el, i) => ({ el: el as HTMLElement, newPage: firstNewPage && i === 0 }))
}

function el(html: string): HTMLElement {
  const d = document.createElement('div')
  d.innerHTML = html
  return d
}

export function pdfFileName(name: string): string {
  return `${safeFileName(name)}_紫微斗数命理分析报告_${formatDate(Date.now())}.pdf`
}

/**
 * 导出正式 PDF 报告：封面、基本信息、命盘十二宫图、各章节、免责声明。
 */
export async function exportReportPdf(
  report: ReportRecord,
  chart: ChartData,
  onProgress?: (msg: string) => void,
): Promise<void> {
  ensureStyle()
  onProgress?.('正在加载 PDF 引擎…')
  const html2pdf = (await import('html2pdf.js')).default
  const b = chart.basicInfo
  const dateStr = new Date(report.completedAt || report.updatedAt).toLocaleDateString('zh-CN')

  const blocks: Block[] = []
  // 1. 封面
  blocks.push({
    newPage: true,
    el: el(`<div class="pdf-cover">
      <div class="seal">紫</div>
      <div class="t1">紫微斗数命理分析报告</div>
      <div class="t2">紫微 AI 命理研究室</div>
      <div class="who">命主：${esc(b.name)}（${esc(b.gender)}）</div>
      <div class="meta">公历 ${esc(b.solarDate)} ${esc(b.clockTime)}<br/>农历 ${esc(b.lunarDate)} ${esc(b.timeBranch)}<br/>${esc(b.fiveElements)} · 命主${esc(b.lifeMaster)} · 身主${esc(b.bodyMaster)}</div>
      <div class="foot">生成日期：${esc(dateStr)}　排盘引擎：iztro　分析模型：${esc(report.model || '—')}</div>
    </div>`),
  })
  // 2. 目录
  const sectionsWithContent = report.sections.filter((s) => s.content.trim())
  blocks.push({
    newPage: true,
    el: el(`<h1>目录</h1><ol class="pdf-toc">
      <li>命主基本信息</li><li>命盘十二宫图</li>
      ${sectionsWithContent.map((s) => `<li>${esc(s.title)}</li>`).join('')}
      <li>免责声明</li></ol>`),
  })
  // 3. 基本信息 + 4. 命盘图
  blocks.push({ newPage: true, el: el(`<h1>命主基本信息</h1>${infoTableHtml(chart)}`) })
  blocks.push({ newPage: true, el: el(`<h1>命盘十二宫图</h1>${chartGridHtml(chart)}`) })
  // 5. 各章节
  report.sections.forEach((s, i) => {
    if (!s.content.trim()) return
    const { html } = renderMarkdown(s.content, `pdf-${i}`)
    blocks.push(...htmlToBlocks(html, true))
  })
  // 6. 免责声明
  blocks.push({
    newPage: true,
    el: el(`<h1>免责声明</h1><div class="pdf-disclaimer">
      <p>1. 本报告命盘数据由开源排盘引擎 iztro 根据命主提供的出生信息计算生成，分析文字由用户自行配置的大语言模型生成。</p>
      <p>2. 紫微斗数属于中国传统文化范畴，命理推演不代表确定会发生的现实事件。</p>
      <p>3. 本报告仅供传统文化研究和娱乐参考，不构成医疗、投资、婚姻、法律等任何专业建议，不应作为重大人生决策的唯一依据。</p>
      <p>4. 出生时间不准确、真太阳时设置不同，均可能导致命盘及分析结果差异。</p>
    </div>`),
  })

  onProgress?.('正在排版…')
  const chunks = chunkBlocks(blocks)

  const opt = {
    margin: [MARGIN_MM[0], MARGIN_MM[1], MARGIN_MM[2], MARGIN_MM[3]],
    filename: pdfFileName(b.name),
    image: { type: 'jpeg', quality: 0.92 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, windowWidth: INNER_WIDTH_PX + 40 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['.keep', 'tr', 'li', 'blockquote', 'pre', '.pdf-grid', '.pdf-info'] },
  }

  // 分批渲染，每批追加到同一份 PDF
  let worker: any = (html2pdf() as any).set(opt).from(chunks[0]).toPdf()
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i]
    const idx = i
    worker = worker
      .get('pdf')
      .then((pdf: any) => {
        onProgress?.(`正在生成第 ${idx + 1} / ${chunks.length} 部分…`)
        pdf.addPage()
      })
      .from(chunk)
      .toContainer()
      .toCanvas()
      .toPdf()
  }
  // 页码
  worker = worker.get('pdf').then((pdf: any) => {
    const total = pdf.internal.getNumberOfPages()
    for (let p = 2; p <= total; p++) {
      pdf.setPage(p)
      pdf.setFontSize(9)
      pdf.setTextColor(150)
      pdf.text(`${p - 1} / ${total - 1}`, 105, 297 - 7, { align: 'center' })
    }
  })
  onProgress?.(`正在生成第 1 / ${chunks.length} 部分…`)
  await worker.save()
}
