import type { ApiConfig } from '@/types/ai'
import type { ChartData } from '@/types/chart'
import type { PromptTemplate, ReportRecord, SectionDef, SectionResult } from '@/types/report'
import { AiError, chatCompletion } from './aiClient'
import { buildMessages, buildSectionPlan } from './promptBuilder'
import { basicInfoText } from './chartAdapter'
import { uid } from '@/utils/common'

export function toSectionResult(def: SectionDef): SectionResult {
  return { ...def, status: 'pending', content: '', error: '', truncated: false, model: '', startedAt: 0, finishedAt: 0 }
}

export function createReport(
  chartId: string,
  chart: ChartData,
  template: PromptTemplate,
  api: ApiConfig | undefined,
  mode: ReportRecord['mode'],
): ReportRecord {
  const now = Date.now()
  return {
    id: uid('report_'),
    chartId,
    mode,
    templateId: template.id,
    templateName: template.name,
    apiName: api?.name ?? '',
    model: api?.model ?? '',
    sections: buildSectionPlan(chart, template, mode).map(toSectionResult),
    fullContent: '',
    createdAt: now,
    updatedAt: now,
    completedAt: 0,
  }
}

/** 将各阶段结果合并为完整报告 Markdown */
export function mergeReport(report: ReportRecord, chart: ChartData): string {
  const b = chart.basicInfo
  const header = [
    `# ${b.name} · 紫微斗数命理分析报告`,
    '',
    `> 生成时间：${new Date(report.completedAt || report.updatedAt).toLocaleString('zh-CN')}　模型：${report.model || '—'}　提示词：${report.templateName}`,
    '',
    '## 命主基本信息',
    '',
    '```text',
    basicInfoText(chart),
    '```',
    '',
  ].join('\n')
  const body = report.sections
    .filter((s) => s.content.trim())
    .map((s) => s.content.trim())
    .join('\n\n---\n\n')
  const footer = '\n\n---\n\n## 免责声明\n\n本报告由程序排盘（iztro）与大语言模型生成，仅供传统文化研究和娱乐参考，不构成医疗、投资、婚姻、法律等专业建议，也不应作为重大人生决策的唯一依据。'
  return `${header}\n${body}${footer}`
}

export function isReportComplete(report: ReportRecord): boolean {
  return report.sections.length > 0 && report.sections.every((s) => s.status === 'done')
}

/** 尝试将超限的章节拆分为更小的批次（Token 超限自动拆分） */
export function splitSection(section: SectionResult, chart: ChartData, template: PromptTemplate): SectionDef[] | null {
  if (section.stage === 'full') {
    return buildSectionPlan(chart, template, 'staged')
  }
  if (section.stage === 'annual' && section.yearFrom !== undefined && section.yearTo !== undefined) {
    const count = section.yearTo - section.yearFrom + 1
    if (count <= 2) return null
    const mid = section.yearFrom + Math.ceil(count / 2) - 1
    const base = { stage: section.stage, group: section.group, decadeOrder: section.decadeOrder }
    return [
      { ...base, id: `${section.id}a`, title: `${section.title.replace(/（.*$/, '')}（${section.yearFrom}～${mid}年）`, yearFrom: section.yearFrom, yearTo: mid },
      { ...base, id: `${section.id}b`, title: `${section.title.replace(/（.*$/, '')}（${mid + 1}～${section.yearTo}年）`, yearFrom: mid + 1, yearTo: section.yearTo },
    ]
  }
  if (section.stage === 'decade' && section.decadeFrom !== undefined && section.decadeTo !== undefined) {
    const count = section.decadeTo - section.decadeFrom + 1
    if (count <= 1) return null
    const mid = section.decadeFrom + Math.ceil(count / 2) - 1
    const base = { stage: section.stage, group: section.group }
    return [
      { ...base, id: `${section.id}a`, title: `大限分析（第${section.decadeFrom + 1}～${mid + 1}大限）`, decadeFrom: section.decadeFrom, decadeTo: mid },
      { ...base, id: `${section.id}b`, title: `大限分析（第${mid + 2}～${section.decadeTo + 1}大限）`, decadeFrom: mid + 1, decadeTo: section.decadeTo },
    ]
  }
  return null
}

export interface RunHooks {
  /** 内容变化（流式增量），用于界面刷新与节流持久化 */
  onProgress: () => void
  /** 阶段状态变化，需要立即持久化 */
  onCheckpoint: () => Promise<void> | void
  /** 某章节被拆分时通知 */
  onSplit?: (from: SectionResult, to: SectionDef[]) => void
}

/**
 * 执行单个章节。返回 'done' | 'failed' | 'aborted' | 'split'
 */
export async function runSection(
  report: ReportRecord,
  sectionId: string,
  ctx: { chart: ChartData; template: PromptTemplate; api: ApiConfig; signal: AbortSignal },
  hooks: RunHooks,
): Promise<'done' | 'failed' | 'aborted' | 'split'> {
  const idx = report.sections.findIndex((s) => s.id === sectionId)
  if (idx < 0) return 'failed'
  const section = report.sections[idx]
  section.status = 'running'
  section.content = ''
  section.error = ''
  section.errorKind = undefined
  section.truncated = false
  section.model = ctx.api.model
  section.startedAt = Date.now()
  section.finishedAt = 0
  await hooks.onCheckpoint()

  try {
    const messages = buildMessages(section, ctx.chart, ctx.template, report.sections)
    const res = await chatCompletion(ctx.api, messages, {
      signal: ctx.signal,
      onDelta: (_d, full) => {
        section.content = full
        hooks.onProgress()
      },
    })
    section.content = res.content
    section.finishedAt = Date.now()
    if (!res.content.trim()) {
      section.status = 'failed'
      section.error = res.reasoning ? '模型仅返回了思考过程，未返回正文，请重试或调大 Max Tokens。' : '模型返回内容为空，请重试。'
      await hooks.onCheckpoint()
      return 'failed'
    }
    if (res.truncated) {
      // 输出被截断：尝试拆分为更小批次
      const parts = splitSection(section, ctx.chart, ctx.template)
      if (parts && section.stage !== 'full') {
        report.sections.splice(idx, 1, ...parts.map(toSectionResult))
        hooks.onSplit?.(section, parts)
        await hooks.onCheckpoint()
        return 'split'
      }
      section.truncated = true
    }
    section.status = 'done'
    await hooks.onCheckpoint()
    return 'done'
  } catch (e) {
    const err = e as AiError & { partial?: string }
    section.finishedAt = Date.now()
    if (err.partial) section.content = err.partial
    if (err.kind === 'aborted') {
      section.status = 'failed'
      section.error = '已手动停止，已保存已生成内容。'
      await hooks.onCheckpoint()
      return 'aborted'
    }
    if (err.kind === 'token') {
      const parts = splitSection(section, ctx.chart, ctx.template)
      if (parts) {
        if (section.stage === 'full') report.mode = 'staged'
        report.sections.splice(idx, 1, ...parts.map(toSectionResult))
        hooks.onSplit?.(section, parts)
        await hooks.onCheckpoint()
        return 'split'
      }
    }
    section.status = 'failed'
    section.error = err.message || String(e)
    section.errorKind = err.kind
    await hooks.onCheckpoint()
    return 'failed'
  }
}
