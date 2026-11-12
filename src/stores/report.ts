import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import type { ChartRecord } from '@/types/chart'
import type { AnalysisMode, ReportRecord, TaskRecord } from '@/types/report'
import * as db from '@/database/indexedDB'
import { createReport, isReportComplete, mergeReport, runSection } from '@/services/analysisService'
import { STAGE_LABELS } from '@/services/promptBuilder'
import { useSettingsStore } from './settings'
import { throttle, toPlain } from '@/utils/common'

export interface StartOptions {
  mode?: AnalysisMode
  templateId?: string
  apiId?: string
}

/** 一次运行所绑定的报告与命盘（避免切换页面后写错对象） */
interface RunTarget {
  report: ReportRecord
  chart: ChartRecord
}

export const useReportStore = defineStore('report', () => {
  const report = ref<ReportRecord | null>(null)
  const chart = ref<ChartRecord | null>(null)
  const task = ref<TaskRecord | null>(null)
  const running = ref(false)
  /** 正在运行分析的命盘 id */
  const runningChartId = ref('')
  const currentSectionId = ref('')
  const lastError = ref('')
  /** 本次分析使用的 API 配置 id（空则使用默认配置） */
  const selectedApiId = ref('')
  let controller: AbortController | null = null
  let runTarget: RunTarget | null = null

  const sections = computed(() => report.value?.sections ?? [])
  const doneCount = computed(() => sections.value.filter((s) => s.status === 'done').length)
  const totalCount = computed(() => sections.value.length)
  const currentSection = computed(() => sections.value.find((s) => s.id === currentSectionId.value) ?? null)
  const complete = computed(() => !!report.value && isReportComplete(report.value))

  function currentTarget(): RunTarget | null {
    if (runTarget) return runTarget
    if (report.value && chart.value) return { report: report.value, chart: chart.value }
    return null
  }

  async function persist(target: RunTarget | null = currentTarget()) {
    if (!target) return
    const { report: rep, chart: ch } = target
    rep.updatedAt = Date.now()
    rep.fullContent = mergeReport(rep, ch.chartData)
    await db.saveReport(toPlain(rep))
    const isRunning = running.value && runningChartId.value === ch.id
    const status: TaskRecord['status'] = isRunning
      ? 'running'
      : isReportComplete(rep)
        ? 'completed'
        : rep.sections.some((s) => s.status === 'failed')
          ? 'failed'
          : 'paused'
    const cur = isRunning ? rep.sections.find((s) => s.id === currentSectionId.value) : undefined
    const t: TaskRecord = {
      id: `task_${rep.id}`,
      chartId: ch.id,
      reportId: rep.id,
      status,
      currentStage: cur ? `${STAGE_LABELS[cur.stage]}：${cur.title}` : '',
      completedStages: rep.sections.filter((s) => s.status === 'done').map((s) => s.id),
      totalStages: rep.sections.length,
      updatedAt: Date.now(),
    }
    if (report.value?.id === rep.id) task.value = t
    await db.saveTask(toPlain(t))
  }

  const persistThrottled = throttle(() => {
    persist().catch(() => undefined)
  }, 1500)

  /** 加载某命盘的最新报告；修复刷新中断导致的 running 状态 */
  async function loadForChart(rec: ChartRecord) {
    if (running.value && runningChartId.value === rec.id) {
      // 正在后台分析的命盘：直接显示运行中的报告对象
      if (runTarget) {
        report.value = runTarget.report
        chart.value = runTarget.chart
      }
      return
    }
    chart.value = rec
    const r = await db.getReportByChart(rec.id)
    if (r) {
      let dirty = false
      for (const s of r.sections) {
        if (s.status === 'running') {
          s.status = 'failed'
          s.error = '分析被中断（页面刷新或关闭），已保存已生成内容，可继续分析。'
          dirty = true
        }
      }
      report.value = r
      if (dirty) await persist({ report: r, chart: rec })
    } else {
      report.value = null
    }
    task.value = (await db.getTaskByChart(rec.id)) ?? null
  }

  function resolveContext(rep: ReportRecord) {
    const settings = useSettingsStore()
    const api = settings.getApi(selectedApiId.value || undefined)
    if (!api || !api.url || !api.model) throw new Error('尚未配置可用的大模型 API，请先前往“API 设置”。')
    const template = settings.getTemplate(rep.templateId)
    return { api, template }
  }

  function guardSingleRun() {
    if (running.value) {
      throw new Error(
        runningChartId.value === chart.value?.id
          ? '当前已有分析正在进行。'
          : '另一个命盘的分析正在进行，请等待完成或先停止该分析。',
      )
    }
  }

  /**
   * 依次执行队列中的章节。
   * pickNext 返回下一个要执行的章节 id，返回 null 结束。
   */
  async function execute(rawTarget: RunTarget, pickNext: (rep: ReportRecord) => string | null) {
    // 统一转为响应式代理，确保章节状态变化能实时反映到界面
    const target: RunTarget = { report: reactive(rawTarget.report) as ReportRecord, chart: rawTarget.chart }
    lastError.value = ''
    const ctx = resolveContext(target.report)
    running.value = true
    runningChartId.value = target.chart.id
    runTarget = target
    controller = new AbortController()
    target.report.model = ctx.api.model
    target.report.apiName = ctx.api.name
    try {
      for (;;) {
        const nextId = pickNext(target.report)
        if (!nextId) break
        currentSectionId.value = nextId
        const result = await runSection(
          target.report,
          nextId,
          { chart: target.chart.chartData, template: ctx.template, api: ctx.api, signal: controller.signal },
          { onProgress: persistThrottled, onCheckpoint: () => persist(target) },
        )
        if (result === 'aborted') break
        if (result === 'failed') {
          lastError.value = target.report.sections.find((x) => x.id === nextId)?.error ?? '分析失败'
          break
        }
      }
      if (isReportComplete(target.report) && !target.report.completedAt) target.report.completedAt = Date.now()
    } finally {
      running.value = false
      runningChartId.value = ''
      currentSectionId.value = ''
      controller = null
      persistThrottled.flush()
      await persist(target)
      runTarget = null
    }
  }

  /** 新建分析（重新分析） */
  async function start(rec: ChartRecord, opts: StartOptions = {}) {
    guardSingleRun()
    const settings = useSettingsStore()
    chart.value = rec
    if (opts.apiId) selectedApiId.value = opts.apiId
    const template = settings.getTemplate(opts.templateId)
    const api = settings.getApi(selectedApiId.value || undefined)
    if (!api || !api.url || !api.model) throw new Error('尚未配置可用的大模型 API，请先前往“API 设置”。')
    const mode = opts.mode ?? settings.general.analysisMode
    const old = report.value && report.value.chartId === rec.id ? report.value : await db.getReportByChart(rec.id)
    if (old) await db.deleteReport(old.id)
    const rep = createReport(rec.id, rec.chartData, template, api, mode)
    report.value = rep
    // 必须使用响应式代理对象，直接修改原始对象不会触发界面更新
    const target = { report: report.value!, chart: rec }
    await persist(target)
    await execute(target, firstUnfinished)
  }

  const firstUnfinished = (rep: ReportRecord) =>
    rep.sections.find((s) => s.status === 'pending' || s.status === 'failed')?.id ?? null

  /** 继续执行所有未完成章节（已完成的阶段不重复生成） */
  async function runPending() {
    guardSingleRun()
    if (!report.value || !chart.value) throw new Error('没有可分析的命盘。')
    await execute({ report: report.value, chart: chart.value }, firstUnfinished)
  }

  /** 单章节重新生成（若因超限被拆分，则继续生成拆分后的子章节） */
  async function retrySection(id: string) {
    guardSingleRun()
    if (!report.value || !chart.value) return
    let first = true
    await execute({ report: report.value, chart: chart.value }, (rep) => {
      if (first) {
        first = false
        return id
      }
      // 原章节被拆分后，继续执行由其拆分出的子章节
      const child = rep.sections.find((s) => s.id.startsWith(id) && s.id !== id && s.status === 'pending')
      return child?.id ?? null
    })
  }

  function stop() {
    controller?.abort()
  }

  async function removeReport() {
    if (!report.value) return
    if (runningChartId.value === report.value.chartId) stop()
    await db.deleteReport(report.value.id)
    report.value = null
    task.value = null
  }

  function fullMarkdown(): string {
    if (!report.value || !chart.value) return ''
    return mergeReport(report.value, chart.value.chartData)
  }

  // 刷新或关闭页面时及时持久化
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      persistThrottled.flush()
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persistThrottled.flush()
    })
  }

  return {
    report,
    chart,
    task,
    running,
    runningChartId,
    currentSectionId,
    currentSection,
    lastError,
    selectedApiId,
    sections,
    doneCount,
    totalCount,
    complete,
    loadForChart,
    start,
    runPending,
    retrySection,
    stop,
    removeReport,
    fullMarkdown,
  }
})
