import type { ChatMessage } from '@/types/ai'
import type { ChartData } from '@/types/chart'
import type { AnalysisMode, PromptTemplate, SectionDef, SectionResult, StageKey } from '@/types/report'
import { annualText, chartToText, decadeText } from './chartAdapter'

export const STAGE_LABELS: Record<StageKey, string> = {
  basic: '第一阶段 · 原局分析',
  life: '第二阶段 · 人生领域',
  decade: '第三阶段 · 大限分析',
  annual: '第四阶段 · 流年分析',
  custom: '自定义分析',
  summary: '第五阶段 · 综合总结',
  full: '单次完整分析',
}

/** 报告目录分组（与 PRD 左侧目录对应） */
export const GROUPS = {
  basic: '命格与十二宫',
  life: '人生领域',
  decade: '大限分析',
  annual: '流年分析',
  custom: '自定义分析',
  summary: '关键事件与总结',
  full: '完整报告',
}

export function fillVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m))
}

/** 生成分析章节计划 */
export function buildSectionPlan(chart: ChartData, template: PromptTemplate, mode: AnalysisMode): SectionDef[] {
  if (mode === 'single') {
    return [{ id: 'full', stage: 'full', title: '完整命理分析报告', group: GROUPS.full }]
  }
  const plan: SectionDef[] = [
    { id: 'basic', stage: 'basic', title: '原局分析：命盘基本信息、命格、十二宫、三方四正、四化', group: GROUPS.basic },
    { id: 'life', stage: 'life', title: '人生领域：性格、学业事业、财富、婚姻、人际、健康', group: GROUPS.life },
  ]
  const n = chart.decades.length
  const half = Math.ceil(n / 2)
  plan.push({ id: 'decade-1', stage: 'decade', title: `大限分析（第1～${half}大限）`, group: GROUPS.decade, decadeFrom: 0, decadeTo: half - 1 })
  if (n > half) {
    plan.push({ id: 'decade-2', stage: 'decade', title: `大限分析（第${half + 1}～${n}大限）`, group: GROUPS.decade, decadeFrom: half, decadeTo: n - 1 })
  }
  for (const d of chart.decades.slice(0, 8)) {
    plan.push({
      id: `annual-${d.order + 1}`,
      stage: 'annual',
      title: `流年分析 · 第${d.order + 1}大限（${d.startYear}～${d.endYear}年，${d.startAge}～${d.endAge}岁）`,
      group: GROUPS.annual,
      decadeOrder: d.order,
      yearFrom: d.startYear,
      yearTo: d.endYear,
    })
  }
  if (template.customItems.trim()) {
    plan.push({ id: 'custom', stage: 'custom', title: '自定义分析项目', group: GROUPS.custom })
  }
  plan.push({ id: 'summary', stage: 'summary', title: '关键事件汇总与综合建议', group: GROUPS.summary })
  return plan
}

/** 前序阶段结果摘要（用于总结阶段） */
export function summarizePrevious(sections: SectionResult[], limit = 24000): string {
  const done = sections.filter((s) => s.status === 'done' && s.content && s.stage !== 'summary')
  if (!done.length) return '（前序阶段暂无结果，请直接依据命盘数据进行总结。）'
  const perSection: Record<string, number> = { basic: 3500, life: 3000, decade: 5000, annual: 1600, custom: 1500 }
  const parts = done.map((s) => {
    const max = perSection[s.stage] ?? 1500
    const body = s.content.length > max ? `${s.content.slice(0, max)}\n……（以下省略）` : s.content
    return `### 【${s.title}】\n${body}`
  })
  let out = parts.join('\n\n')
  if (out.length > limit) out = `${out.slice(0, limit)}\n……（摘要已截断）`
  return out
}

function baseVars(chart: ChartData, template: PromptTemplate, chartText: string): Record<string, string> {
  return {
    CHART_DATA: chartText,
    NAME: chart.basicInfo.name,
    GENDER: chart.basicInfo.gender,
    CURRENT_YEAR: String(new Date().getFullYear()),
    CUSTOM_ITEMS: template.customItems.trim() || '（无）',
  }
}

/** 为某一章节构造请求消息 */
export function buildMessages(
  section: SectionDef,
  chart: ChartData,
  template: PromptTemplate,
  allSections: SectionResult[] = [],
): ChatMessage[] {
  const messages: ChatMessage[] = []
  if (template.system.trim()) messages.push({ role: 'system', content: template.system.trim() })

  if (section.stage === 'full') {
    const vars = baseVars(chart, template, chartToText(chart, { annualDecades: 8 }))
    let user = fillVars(template.content, vars)
    if (!template.content.includes('{{CHART_DATA}}')) user += `\n\n## 命盘信息\n\n${vars.CHART_DATA}`
    if (template.customItems.trim() && !template.content.includes('{{CUSTOM_ITEMS}}')) {
      user += `\n\n## 自定义分析项目\n\n${template.customItems.trim()}`
    }
    messages.push({ role: 'user', content: user })
    return messages
  }

  // 分阶段：所有阶段共用相同的命盘数据（不含逐年流年，流年数据按批次单独提供）
  const vars = baseVars(chart, template, chartToText(chart, { annualDecades: 0 }))
  let base = fillVars(template.content, vars)
  if (!template.content.includes('{{CHART_DATA}}')) base += `\n\n## 命盘信息\n\n${vars.CHART_DATA}`

  const stageVars: Record<string, string> = { ...vars }
  if (section.stage === 'decade') {
    const from = section.decadeFrom ?? 0
    const to = section.decadeTo ?? chart.decades.length - 1
    stageVars.DECADE_FROM = String(from + 1)
    stageVars.DECADE_TO = String(to + 1)
    stageVars.DECADE_LIST = chart.decades
      .slice(from, to + 1)
      .map((d) => decadeText(chart, d))
      .join('\n\n')
  }
  if (section.stage === 'annual') {
    const d = chart.decades[section.decadeOrder ?? 0]
    const years = d.years.filter((y) => y.year >= (section.yearFrom ?? 0) && y.year <= (section.yearTo ?? 9999))
    stageVars.DECADE_NO = String(d.order + 1)
    stageVars.DECADE_RANGE = `第${d.order + 1}大限 ${d.startAge}～${d.endAge}岁（${d.startYear}～${d.endYear}年），大限命宫在${d.branch}（原局${d.palaceName}）`
    stageVars.DECADE_INFO = decadeText(chart, d)
    stageVars.YEAR_FROM = String(years[0]?.year ?? section.yearFrom)
    stageVars.YEAR_TO = String(years[years.length - 1]?.year ?? section.yearTo)
    stageVars.YEAR_COUNT = String(years.length)
    stageVars.ANNUAL_DATA = years.map((y) => annualText(chart, y)).join('\n')
  }
  if (section.stage === 'summary') {
    stageVars.PREVIOUS_RESULTS = summarizePrevious(allSections)
  }
  const stageKey = section.stage as keyof PromptTemplate['stages']
  const stagePrompt = fillVars(template.stages[stageKey] || '', stageVars)
  messages.push({ role: 'user', content: `${base}\n\n---\n\n${stagePrompt}` })
  return messages
}

/** 预览最终拼接后的提示词 */
export function previewPrompt(
  chart: ChartData,
  template: PromptTemplate,
  mode: AnalysisMode,
  sectionId?: string,
): { section: SectionDef; messages: ChatMessage[] }[] {
  const plan = buildSectionPlan(chart, template, mode)
  const list = sectionId ? plan.filter((s) => s.id === sectionId) : plan
  return list.map((section) => ({ section, messages: buildMessages(section, chart, template, []) }))
}
