<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton,
  NCard,
  NSelect,
  NRadioGroup,
  NRadio,
  NSpin,
  NResult,
  NAlert,
  NModal,
  NTabs,
  NTabPane,
  NDrawer,
  NDrawerContent,
  NDropdown,
  useMessage,
  useDialog,
} from 'naive-ui'
import {
  Sparkles,
  Copy,
  FileDown,
  FileText,
  Trash2,
  Pencil,
  Eye,
  ListTree,
  RefreshCw,
  CircleStop,
  Play,
  LayoutGrid,
} from 'lucide-vue-next'
import ReportProgress from '@/components/Report/ReportProgress.vue'
import ReportSidebar from '@/components/Report/ReportSidebar.vue'
import ReportViewer from '@/components/Report/ReportViewer.vue'
import ApiStatus from '@/components/Common/ApiStatus.vue'
import type { ChartRecord } from '@/types/chart'
import type { AnalysisMode } from '@/types/report'
import type { RenderedSection } from '@/types/reportView'
import { useChartStore } from '@/stores/chart'
import { useReportStore } from '@/stores/report'
import { useSettingsStore } from '@/stores/settings'
import { renderMarkdown } from '@/utils/markdown'
import { copyText, downloadText, formatDate, formatDateTime, safeFileName } from '@/utils/common'
import { previewPrompt, STAGE_LABELS } from '@/services/promptBuilder'
import { resolveEndpoint } from '@/services/aiClient'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const chartStore = useChartStore()
const reportStore = useReportStore()
const settings = useSettingsStore()

const record = ref<ChartRecord | null>(null)
const loading = ref(true)
const error = ref('')

const apiId = ref(settings.defaultApi?.id ?? '')
const templateId = ref(settings.defaultTemplate.id)
const mode = ref<AnalysisMode>(settings.general.analysisMode)

const apiOptions = computed(() => settings.apiConfigs.map((c) => ({ label: `${c.name}（${c.model}）`, value: c.id })))
const templateOptions = computed(() => settings.templates.map((t) => ({ label: t.name, value: t.id })))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const rec = await chartStore.load(String(route.params.id))
    if (!rec) throw new Error('命盘不存在或已被删除。')
    record.value = rec
    await reportStore.loadForChart(rec)
    if (route.query.template && settings.templates.some((t) => t.id === String(route.query.template))) {
      templateId.value = String(route.query.template)
    } else if (reportStore.report) {
      templateId.value = settings.templates.some((t) => t.id === reportStore.report!.templateId)
        ? reportStore.report.templateId
        : settings.defaultTemplate.id
    }
    if (reportStore.report) mode.value = reportStore.report.mode
    if (!reportStore.selectedApiId) reportStore.selectedApiId = apiId.value
    else apiId.value = reportStore.selectedApiId
    const action = String(route.query.action || '')
    if (action) {
      router.replace({ path: route.path })
      if (action === 'start' && !reportStore.report) startAnalysis()
      else if (action === 'restart') reportStore.report ? restart() : startAnalysis()
      else if (action === 'resume' && reportStore.report && !reportStore.complete && !reportStore.running) resume()
    }
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
watch(() => route.params.id, load, { immediate: true })
watch(apiId, (v) => (reportStore.selectedApiId = v))

const report = computed(() => reportStore.report)
const chart = computed(() => record.value?.chartData ?? null)
const hasReport = computed(() => !!report.value)
/** 当前命盘是否正在分析（其他命盘在后台分析时为 false） */
const runningHere = computed(() => reportStore.running && reportStore.runningChartId === record.value?.id)

/* ---------- 渲染（按章节缓存） ---------- */
const cache = new Map<string, { content: string; result: ReturnType<typeof renderMarkdown> }>()
const rendered = computed<RenderedSection[]>(() => {
  const list = report.value?.sections ?? []
  return list.map((section, i) => {
    const key = section.id
    let c = cache.get(key)
    if (!c || c.content !== section.content) {
      c = { content: section.content, result: renderMarkdown(section.content, `r${i}-${section.id}`) }
      cache.set(key, c)
    }
    return { section, html: c.result.html, toc: c.result.toc, failed: c.result.failed }
  })
})

/* ---------- 操作 ---------- */
function ensureApi(): boolean {
  if (!settings.apiConfigs.length) {
    dialog.warning({
      title: '尚未配置大模型 API',
      content: 'AI 分析需要先配置 API URL、API Key 和模型名称。',
      positiveText: '去配置',
      negativeText: '取消',
      onPositiveClick: () => router.push('/settings/api'),
    })
    return false
  }
  const api = settings.getApi(apiId.value)
  if (!api?.url || !api.model) {
    message.warning('所选 API 配置不完整，请检查 URL 与模型名称。')
    return false
  }
  return true
}

async function run(fn: () => Promise<void>) {
  try {
    await fn()
    if (reportStore.complete) message.success('分析完成，报告已保存')
  } catch (e) {
    message.error((e as Error).message)
  }
}

function startAnalysis() {
  if (!record.value || !ensureApi()) return
  const api = settings.getApi(apiId.value)!
  const doStart = () =>
    run(() => reportStore.start(record.value!, { mode: mode.value, templateId: templateId.value, apiId: apiId.value }))
  if (!settings.general.privacyAcknowledged) {
    dialog.info({
      title: '数据发送提示',
      content: `开始分析后，命盘数据（含姓名、出生时间等）将发送到你配置的模型服务：${resolveEndpoint(api)}。第三方模型服务可能处理并保存请求数据。`,
      positiveText: '我已了解，开始分析',
      negativeText: '取消',
      onPositiveClick: () => {
        settings.general.privacyAcknowledged = true
        doStart()
      },
    })
    return
  }
  doStart()
}

function restart() {
  if (!record.value || !ensureApi()) return
  dialog.warning({
    title: '重新分析',
    content: '将使用当前选择的 API、提示词模板和分析模式重新执行全部分析，现有报告内容会被清除。确定继续吗？',
    positiveText: '重新分析',
    negativeText: '取消',
    onPositiveClick: () => {
      run(() => reportStore.start(record.value!, { mode: mode.value, templateId: templateId.value, apiId: apiId.value }))
    },
  })
}

function resume() {
  if (!ensureApi()) return
  run(() => reportStore.runPending())
}

function retry(id: string) {
  if (!ensureApi()) return
  run(() => reportStore.retrySection(id))
}

function stop() {
  reportStore.stop()
}

function editPrompt() {
  router.push({ path: '/settings/prompts', query: { template: templateId.value, back: route.fullPath } })
}

async function copyReport() {
  try {
    await copyText(reportStore.fullMarkdown())
    message.success('已复制全部 Markdown')
  } catch (e) {
    message.error((e as Error).message)
  }
}

function downloadMd() {
  if (!chart.value) return
  downloadText(
    reportStore.fullMarkdown(),
    `${safeFileName(chart.value.basicInfo.name)}_紫微斗数命理分析报告_${formatDate(Date.now())}.md`,
    'text/markdown;charset=utf-8',
  )
}

const pdfLoading = ref(false)
const pdfMsg = ref('')
async function downloadPdf() {
  if (!report.value || !chart.value) return
  if (!report.value.sections.some((s) => s.content.trim())) {
    message.warning('报告暂无内容')
    return
  }
  pdfLoading.value = true
  try {
    const { exportReportPdf } = await import('@/services/pdfService')
    await exportReportPdf(report.value, chart.value, (m) => (pdfMsg.value = m))
    message.success('PDF 已生成')
  } catch (e) {
    dialog.error({
      title: 'PDF 导出失败',
      content: `${(e as Error).message || e}。可改为下载 Markdown 报告。`,
      positiveText: '下载 Markdown',
      negativeText: '关闭',
      onPositiveClick: downloadMd,
    })
  } finally {
    pdfLoading.value = false
    pdfMsg.value = ''
  }
}

function deleteReport() {
  dialog.warning({
    title: '删除报告',
    content: '确定删除该命盘的 AI 分析报告吗？命盘本身会保留。此操作不可恢复。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await reportStore.removeReport()
      cache.clear()
      message.success('报告已删除')
    },
  })
}

const moreOptions = computed(() => [
  { label: '修改提示词后重新分析', key: 'prompt' },
  { label: '查看命盘', key: 'chart' },
  { label: '删除报告', key: 'delete', disabled: !hasReport.value },
])
function onMore(key: string) {
  if (key === 'prompt') editPrompt()
  else if (key === 'chart') router.push(`/chart/${record.value?.id}`)
  else if (key === 'delete') deleteReport()
}

/* ---------- 提示词预览 ---------- */
const previewOpen = ref(false)
const previewSection = ref<string | null>(null)
const previewData = computed(() => {
  if (!chart.value || !previewOpen.value) return []
  const t = settings.getTemplate(templateId.value)
  return previewPrompt(chart.value, t, mode.value)
})
watch(previewData, (list) => {
  if (list.length && !list.some((x) => x.section.id === previewSection.value)) previewSection.value = list[0].section.id
})
const previewCurrent = computed(() => previewData.value.find((x) => x.section.id === previewSection.value))

/* ---------- 目录导航 ---------- */
const tocDrawer = ref(false)
const activeId = ref('')
function navigate(id: string) {
  tocDrawer.value = false
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  activeId.value = id
}
let raf = 0
function onScroll() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    const anchors = Array.from(document.querySelectorAll<HTMLElement>('.report-viewer section[id], .report-viewer h2[id]'))
    let cur = ''
    for (const a of anchors) {
      if (a.getBoundingClientRect().top < 120) cur = a.id
      else break
    }
    activeId.value = cur
  })
}
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

/* ---------- 自动滚动到正在生成的章节 ---------- */
watch(
  () => reportStore.currentSectionId,
  (id) => {
    if (id) setTimeout(() => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  },
)
</script>

<template>
  <div class="page analysis-page">
    <div v-if="loading" class="center-box"><NSpin size="large" /></div>
    <NResult v-else-if="error" status="warning" title="无法打开分析页面" :description="error">
      <template #footer>
        <NButton type="primary" @click="router.push('/')">返回首页</NButton>
      </template>
    </NResult>
    <template v-else-if="record && chart">
      <div class="page-title serif">
        <span>{{ chart.basicInfo.name }} · AI 命理分析</span>
        <NButton size="small" quaternary @click="router.push(`/chart/${record.id}`)">
          <template #icon><LayoutGrid :size="15" /></template>
          查看命盘
        </NButton>
      </div>

      <!-- 分析设置 -->
      <NCard size="small" :bordered="false" class="setup">
        <div class="setup-grid">
          <div class="field">
            <label>大模型 API</label>
            <NSelect v-model:value="apiId" :options="apiOptions" placeholder="请先配置 API" :disabled="runningHere" />
          </div>
          <div class="field">
            <label>提示词模板</label>
            <NSelect v-model:value="templateId" :options="templateOptions" :disabled="runningHere" />
          </div>
          <div class="field">
            <label>分析模式</label>
            <NRadioGroup v-model:value="mode" :disabled="runningHere">
              <NRadio value="staged">分阶段（推荐）</NRadio>
              <NRadio value="single">单次完整</NRadio>
            </NRadioGroup>
          </div>
        </div>
        <div class="muted small mode-tip">
          <template v-if="mode === 'staged'">
            分阶段模式：原局 → 人生领域 → 十二大限 → 前八大限 80 个流年（每个大限独立请求）→ 综合总结，每个阶段独立请求、可单独重试，已完成阶段不重复生成；Token 超限时自动拆分。
          </template>
          <template v-else>单次模式：一次请求生成全部内容，受模型输出长度限制，长报告可能被截断；若超出上下文将自动切换为分阶段。</template>
        </div>
        <div class="setup-actions">
          <NButton v-if="!hasReport" type="primary" :disabled="runningHere" @click="startAnalysis">
            <template #icon><Sparkles :size="16" /></template>
            开始 AI 分析
          </NButton>
          <template v-else>
            <NButton v-if="runningHere" type="error" secondary @click="stop">
              <template #icon><CircleStop :size="16" /></template>
              停止生成
            </NButton>
            <NButton v-else-if="!reportStore.complete" type="primary" @click="resume">
              <template #icon><Play :size="16" /></template>
              继续分析
            </NButton>
            <NButton :disabled="runningHere" @click="restart">
              <template #icon><RefreshCw :size="16" /></template>
              重新分析
            </NButton>
          </template>
          <NButton @click="previewOpen = true">
            <template #icon><Eye :size="16" /></template>
            预览提示词
          </NButton>
          <NButton @click="editPrompt">
            <template #icon><Pencil :size="16" /></template>
            修改提示词
          </NButton>
        </div>
        <div v-if="!settings.apiConfigs.length" style="margin-top: 10px">
          <ApiStatus />
        </div>
      </NCard>

      <template v-if="report">
        <div class="report-toolbar">
          <div class="muted small meta">
            模型：{{ report.model || '—' }} · 模板：{{ report.templateName }} · 模式：{{ report.mode === 'staged' ? '分阶段' : '单次' }} · 创建：{{ formatDateTime(report.createdAt) }}
            <template v-if="report.completedAt"> · 完成：{{ formatDateTime(report.completedAt) }}</template>
          </div>
          <div class="ops">
            <NButton size="small" class="toc-btn" @click="tocDrawer = true">
              <template #icon><ListTree :size="15" /></template>
              目录
            </NButton>
            <NButton size="small" @click="copyReport">
              <template #icon><Copy :size="15" /></template>
              复制报告
            </NButton>
            <NButton size="small" @click="downloadMd">
              <template #icon><FileText :size="15" /></template>
              下载 Markdown
            </NButton>
            <NButton size="small" type="primary" secondary :loading="pdfLoading" @click="downloadPdf">
              <template #icon><FileDown :size="15" /></template>
              {{ pdfLoading ? pdfMsg || '生成中…' : '下载 PDF' }}
            </NButton>
            <NButton size="small" type="error" quaternary @click="deleteReport">
              <template #icon><Trash2 :size="15" /></template>
              删除报告
            </NButton>
            <NDropdown :options="moreOptions" @select="onMore">
              <NButton size="small" quaternary>更多</NButton>
            </NDropdown>
          </div>
        </div>

        <div class="report-layout">
          <aside class="toc">
            <div class="toc-inner">
              <div class="toc-title">报告目录</div>
              <ReportSidebar :items="rendered" :active-id="activeId" @navigate="navigate" />
            </div>
          </aside>
          <div class="content">
            <ReportProgress
              :sections="report.sections"
              :running="runningHere"
              :current-section-id="reportStore.currentSectionId"
              :last-error="reportStore.lastError"
              @stop="stop"
              @resume="resume"
              @restart="restart"
              @jump="(id: string) => navigate(`sec-${id}`)"
            />
            <NAlert v-if="report.sections.some((s) => s.truncated)" type="warning" class="trunc">
              部分章节输出达到 Max Tokens 上限可能被截断，可调大 API 设置中的 Max Tokens 后点击“重试本章”。
            </NAlert>
            <ReportViewer
              :items="rendered"
              :running="runningHere"
              :current-section-id="reportStore.currentSectionId"
              @retry="retry"
            />
            <div class="disclaimer muted small">
              本报告由程序排盘与大语言模型生成，仅供传统文化研究和娱乐参考，不构成医疗、投资、婚姻、法律等专业建议。
            </div>
          </div>
        </div>
      </template>
      <NCard v-else size="small" :bordered="false" class="empty-card">
        <div class="empty-tip">
          <Sparkles :size="36" />
          <div>尚未生成分析报告。选择 API、提示词模板与分析模式后，点击“开始 AI 分析”。</div>
          <div class="muted small">完整分析包含 {{ chart.decades.length }} 个大限与前 8 个大限共 80 个流年，分阶段模式约需 13 次模型请求。</div>
        </div>
      </NCard>

      <NDrawer v-model:show="tocDrawer" placement="left" :width="300">
        <NDrawerContent title="报告目录" closable>
          <ReportSidebar :items="rendered" :active-id="activeId" @navigate="navigate" />
        </NDrawerContent>
      </NDrawer>

      <NModal v-model:show="previewOpen" preset="card" title="预览最终拼接后的完整提示词" style="width: min(1000px, 96vw)">
        <NTabs :value="previewSection ?? undefined" type="line" size="small" @update:value="(v: string) => (previewSection = v)">
          <NTabPane v-for="p in previewData" :key="p.section.id" :name="p.section.id" :tab="p.section.title.replace(/：.*$/, '')" />
        </NTabs>
        <div v-if="previewCurrent" class="preview">
          <div class="muted small">
            {{ STAGE_LABELS[previewCurrent.section.stage] }} · 共 {{ previewCurrent.messages.reduce((n, m) => n + m.content.length, 0) }} 字
          </div>
          <div v-for="(m, i) in previewCurrent.messages" :key="i" class="msg">
            <div class="role">{{ m.role }}</div>
            <pre>{{ m.content }}</pre>
          </div>
        </div>
      </NModal>
    </template>
  </div>
</template>

<style scoped>
.center-box {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}
.setup {
  margin-bottom: 14px;
}
.setup-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.field label {
  display: block;
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.mode-tip {
  margin: 10px 0;
}
.setup-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.report-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.ops {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.toc-btn {
  display: none;
}
.report-layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}
.toc {
  position: sticky;
  top: 76px;
}
.toc-inner {
  max-height: calc(100vh - 96px);
  overflow-y: auto;
  padding: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.toc-title {
  font-weight: 700;
  margin-bottom: 10px;
}
.content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: var(--reading-width);
  width: 100%;
}
.disclaimer {
  text-align: center;
  padding: 8px;
}
.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px 12px;
  text-align: center;
  color: var(--primary);
}
.empty-tip > div:first-of-type {
  color: var(--text);
}
.preview {
  max-height: 65vh;
  overflow: auto;
}
.msg {
  margin-top: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.msg .role {
  padding: 4px 10px;
  background: var(--primary-soft);
  font-weight: 700;
  font-size: 0.85rem;
}
.msg pre {
  margin: 0;
  padding: 10px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.8rem;
}
@media (max-width: 960px) {
  .report-layout {
    grid-template-columns: 1fr;
  }
  .toc {
    display: none;
  }
  .toc-btn {
    display: inline-flex;
  }
  .setup-grid {
    grid-template-columns: 1fr;
  }
}
</style>
