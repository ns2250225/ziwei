<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NCard,
  NDataTable,
  NInput,
  NTag,
  NDropdown,
  NEmpty,
  NSpace,
  useMessage,
  useDialog,
  type DataTableColumns,
} from 'naive-ui'
import { Search, Download, Upload, Trash2, Sparkles, LayoutGrid } from 'lucide-vue-next'
import type { ChartRecord } from '@/types/chart'
import type { ReportRecord, TaskRecord } from '@/types/report'
import * as db from '@/database/indexedDB'
import { useChartStore } from '@/stores/chart'
import { useReportStore } from '@/stores/report'
import { downloadText, formatDate, formatDateTime, pickFile, readFileText } from '@/utils/common'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const chartStore = useChartStore()
const reportStore = useReportStore()

interface Row {
  chart: ChartRecord
  report?: ReportRecord
  task?: TaskRecord
}

const rows = ref<Row[]>([])
const loading = ref(true)
const keyword = ref('')

async function load() {
  loading.value = true
  try {
    const [charts, reports, tasks] = await Promise.all([db.listCharts(), db.listReports(), db.listTasks()])
    const rmap = new Map<string, ReportRecord>()
    for (const r of reports.sort((a, b) => a.updatedAt - b.updatedAt)) rmap.set(r.chartId, r)
    const tmap = new Map<string, TaskRecord>()
    for (const t of tasks.sort((a, b) => a.updatedAt - b.updatedAt)) tmap.set(t.chartId, t)
    rows.value = charts.map((c) => ({ chart: c, report: rmap.get(c.id), task: tmap.get(c.id) }))
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const filtered = computed(() => {
  const k = keyword.value.trim()
  if (!k) return rows.value
  return rows.value.filter(
    (r) => r.chart.basicInfo.name.includes(k) || r.chart.chartData.basicInfo.solarDate.includes(k),
  )
})

function statusOf(r: Row): { text: string; type: 'default' | 'success' | 'warning' | 'error' | 'info' } {
  if (reportStore.running && reportStore.runningChartId === r.chart.id) return { text: '分析中', type: 'info' }
  if (!r.report) return { text: '未分析', type: 'default' }
  const total = r.report.sections.length
  const done = r.report.sections.filter((s) => s.status === 'done').length
  if (total && done === total) return { text: '已完成', type: 'success' }
  if (r.report.sections.some((s) => s.status === 'failed')) return { text: `未完成 ${done}/${total}`, type: 'error' }
  return { text: `部分完成 ${done}/${total}`, type: 'warning' }
}

async function downloadPdf(r: Row) {
  if (!r.report || !r.report.sections.some((s) => s.content.trim())) {
    message.warning('该记录暂无报告内容')
    return
  }
  const m = message.loading('正在生成 PDF…', { duration: 0 })
  try {
    const { exportReportPdf } = await import('@/services/pdfService')
    await exportReportPdf(r.report, r.chart.chartData)
    message.success('PDF 已生成')
  } catch (e) {
    dialog.error({
      title: 'PDF 导出失败',
      content: `${(e as Error).message}。可改为下载 Markdown 报告。`,
      positiveText: '下载 Markdown',
      onPositiveClick: () => downloadText(r.report!.fullContent, `${r.chart.basicInfo.name}_命理报告.md`, 'text/markdown;charset=utf-8'),
    })
  } finally {
    m.destroy()
  }
}

function remove(r: Row) {
  dialog.warning({
    title: '删除记录',
    content: `确定删除「${r.chart.basicInfo.name}」的命盘及其分析报告吗？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      if (reportStore.runningChartId === r.chart.id) reportStore.stop()
      await chartStore.remove(r.chart.id)
      rows.value = rows.value.filter((x) => x.chart.id !== r.chart.id)
      message.success('已删除')
    },
  })
}

function onAction(key: string, r: Row) {
  const id = r.chart.id
  switch (key) {
    case 'chart':
      router.push(`/chart/${id}`)
      break
    case 'report':
      router.push(`/analysis/${id}`)
      break
    case 'resume':
      router.push({ path: `/analysis/${id}`, query: { action: 'resume' } })
      break
    case 'restart':
      router.push({ path: `/analysis/${id}`, query: { action: 'restart' } })
      break
    case 'edit':
      chartStore.startEdit(r.chart)
      router.push('/')
      break
    case 'pdf':
      downloadPdf(r)
      break
    case 'md':
      if (r.report) downloadText(r.report.fullContent, `${r.chart.basicInfo.name}_命理报告.md`, 'text/markdown;charset=utf-8')
      break
    case 'delete':
      remove(r)
      break
  }
}

function actionOptions(r: Row) {
  const st = statusOf(r)
  return [
    { label: '继续未完成的分析', key: 'resume', disabled: !r.report || st.type === 'success' },
    { label: r.report ? '重新生成报告' : '开始 AI 分析', key: 'restart' },
    { label: '修改出生信息并重新排盘', key: 'edit' },
    { type: 'divider', key: 'd1' },
    { label: '下载 PDF', key: 'pdf', disabled: !r.report },
    { label: '下载 Markdown', key: 'md', disabled: !r.report },
    { type: 'divider', key: 'd2' },
    { label: '删除记录', key: 'delete' },
  ]
}

const columns: DataTableColumns<Row> = [
  {
    title: '姓名',
    key: 'name',
    minWidth: 100,
    render: (r) => h('b', r.chart.basicInfo.name),
  },
  { title: '性别', key: 'gender', width: 60, render: (r) => r.chart.basicInfo.gender },
  {
    title: '出生日期',
    key: 'date',
    width: 120,
    render: (r) =>
      r.chart.basicInfo.calendar === 'lunar'
        ? h('span', { title: r.chart.chartData.basicInfo.lunarDate }, `${r.chart.chartData.basicInfo.solarDate}（农）`)
        : r.chart.chartData.basicInfo.solarDate,
  },
  { title: '出生时间', key: 'time', width: 90, render: (r) => r.chart.chartData.basicInfo.clockTime },
  { title: '排盘时间', key: 'createdAt', width: 150, render: (r) => formatDateTime(r.chart.createdAt) },
  {
    title: '分析状态',
    key: 'status',
    width: 130,
    render: (r) => {
      const s = statusOf(r)
      return h(NTag, { size: 'small', type: s.type, bordered: false }, { default: () => s.text })
    },
  },
  {
    title: '报告生成时间',
    key: 'reportAt',
    width: 150,
    render: (r) => (r.report?.completedAt ? formatDateTime(r.report.completedAt) : r.report ? `更新于 ${formatDateTime(r.report.updatedAt)}` : '—'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 230,
    fixed: 'right',
    render: (r) =>
      h(NSpace, { size: 4, wrap: false }, () => [
        h(NButton, { size: 'tiny', secondary: true, onClick: () => onAction('chart', r) }, { default: () => '查看命盘', icon: () => h(LayoutGrid, { size: 13 }) }),
        h(
          NButton,
          { size: 'tiny', type: 'primary', secondary: true, onClick: () => onAction('report', r) },
          { default: () => (r.report ? '查看报告' : 'AI 分析'), icon: () => h(Sparkles, { size: 13 }) },
        ),
        h(
          NDropdown,
          { options: actionOptions(r), onSelect: (k: string) => onAction(k, r), trigger: 'click' },
          { default: () => h(NButton, { size: 'tiny', quaternary: true }, { default: () => '更多' }) },
        ),
      ]),
  },
]

/* ---------- 导入导出 ---------- */
async function exportHistory() {
  try {
    const data = await db.exportAll()
    downloadText(JSON.stringify(data, null, 2), `紫微命理_历史记录_${formatDate(Date.now())}.json`, 'application/json')
    message.success(`已导出 ${data.charts.length} 条命盘记录（不含 API Key）`)
  } catch (e) {
    message.error((e as Error).message)
  }
}

async function importHistory() {
  const file = await pickFile('.json,application/json')
  if (!file) return
  try {
    const data = JSON.parse(await readFileText(file))
    const r = await db.importAll(data)
    message.success(`已导入 ${r.charts} 条命盘、${r.reports} 份报告`)
    await load()
  } catch (e) {
    message.error(`导入失败：${(e as Error).message}`)
  }
}

function clearAll() {
  dialog.error({
    title: '清空全部历史记录',
    content: '将删除本地所有命盘、分析报告与任务记录，且无法恢复。建议先导出备份。确定清空吗？',
    positiveText: '确定清空',
    negativeText: '取消',
    onPositiveClick: async () => {
      reportStore.stop()
      await db.clearAll()
      rows.value = []
      chartStore.recent = []
      reportStore.report = null
      message.success('已清空')
    },
  })
}
</script>

<template>
  <div class="page">
    <div class="page-title serif">历史记录</div>
    <NCard :bordered="false">
      <div class="toolbar">
        <NInput v-model:value="keyword" placeholder="按姓名或出生日期搜索" clearable style="max-width: 280px">
          <template #prefix><Search :size="15" /></template>
        </NInput>
        <div class="grow" />
        <NButton @click="exportHistory">
          <template #icon><Download :size="15" /></template>
          导出历史
        </NButton>
        <NButton @click="importHistory">
          <template #icon><Upload :size="15" /></template>
          导入历史
        </NButton>
        <NButton type="error" secondary :disabled="!rows.length" @click="clearAll">
          <template #icon><Trash2 :size="15" /></template>
          清空全部
        </NButton>
      </div>
      <NDataTable
        v-if="loading || filtered.length"
        :columns="columns"
        :data="filtered"
        :loading="loading"
        :row-key="(r: Row) => r.chart.id"
        :scroll-x="1060"
        :pagination="{ pageSize: 15 }"
        size="small"
      />
      <NEmpty v-else description="暂无历史记录" style="padding: 40px 0">
        <template #extra>
          <NButton type="primary" @click="router.push('/')">去排盘</NButton>
        </template>
      </NEmpty>
      <div class="muted small note">历史记录保存在本浏览器的 IndexedDB 中，清除浏览器数据后将无法恢复，请定期导出备份。</div>
    </NCard>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 12px;
}
.note {
  margin-top: 12px;
}
</style>
