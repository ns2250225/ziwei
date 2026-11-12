<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton,
  NCard,
  NDrawer,
  NDrawerContent,
  NAlert,
  NSpin,
  NResult,
  NRadioGroup,
  NRadioButton,
  NDropdown,
  NTag,
  NCollapse,
  NCollapseItem,
  useMessage,
} from 'naive-ui'
import { Sparkles, Pencil, Share2, Download, LayoutGrid, List, Save, X } from 'lucide-vue-next'
import ZiweiChart from '@/components/Chart/ZiweiChart.vue'
import PalaceCard from '@/components/Chart/PalaceCard.vue'
import PalaceDetail from '@/components/Chart/PalaceDetail.vue'
import DecadePanel from '@/components/Chart/DecadePanel.vue'
import type { BirthInput, ChartRecord } from '@/types/chart'
import { computeChart, useChartStore } from '@/stores/chart'
import { useSettingsStore } from '@/stores/settings'
import { chartToText, PALACE_ORDER } from '@/services/chartAdapter'
import { saveChart } from '@/database/indexedDB'
import { copyText, decodeShare, downloadText, encodeShare, safeFileName } from '@/utils/common'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const chartStore = useChartStore()
const settings = useSettingsStore()

const record = ref<ChartRecord | null>(null)
const loading = ref(true)
const error = ref('')
const isShare = computed(() => route.name === 'share')
const savedShare = ref(false)

const selectedPalace = ref<number | null>(null)
const decadeOrder = ref<number | null>(null)
const year = ref<number | null>(null)
const drawer = ref(false)
const viewMode = ref<'grid' | 'list'>(window.innerWidth < 640 ? 'list' : 'grid')

async function load() {
  loading.value = true
  error.value = ''
  record.value = null
  try {
    if (isShare.value) {
      const d = String(route.query.d || '')
      if (!d) throw new Error('分享链接无效。')
      const input = decodeShare<BirthInput>(d)
      record.value = computeChart(input)
    } else {
      const rec = await chartStore.load(String(route.params.id))
      if (!rec) throw new Error('命盘不存在或已被删除。')
      record.value = rec
    }
    // 默认选中当前所处大限
    const now = new Date().getFullYear()
    const cur = record.value.chartData.decades.find((d) => now >= d.startYear && now <= d.endYear)
    decadeOrder.value = cur ? cur.order : null
    year.value = null
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

watch(() => [route.params.id, route.query.d], load, { immediate: true })

const chart = computed(() => record.value?.chartData ?? null)

function onSelectPalace(i: number | null) {
  selectedPalace.value = i
  if (i !== null) drawer.value = true
}

function goAnalysis() {
  if (!record.value) return
  router.push(`/analysis/${record.value.id}`)
}

function editChart() {
  if (!record.value) return
  chartStore.startEdit(record.value)
  router.push('/')
}

async function share() {
  if (!record.value) return
  // 分享链接只包含出生信息，不包含 API Key、报告等数据
  const url = `${location.origin}${location.pathname}#/share?d=${encodeShare(record.value.basicInfo)}`
  try {
    await copyText(url)
    message.success('分享链接已复制（仅包含出生信息）')
  } catch (e) {
    message.error((e as Error).message)
  }
}

async function saveShared() {
  if (!record.value) return
  await saveChart(record.value)
  savedShare.value = true
  message.success('已保存到历史记录')
  router.replace(`/chart/${record.value.id}`)
}

const exportOptions = [
  { label: '导出命盘文本（.txt）', key: 'txt' },
  { label: '导出命盘 JSON（.json）', key: 'json' },
]
function onExport(key: string) {
  if (!chart.value) return
  const name = safeFileName(chart.value.basicInfo.name)
  if (key === 'txt') downloadText(chartToText(chart.value), `${name}_紫微命盘.txt`)
  else downloadText(JSON.stringify(chart.value, null, 2), `${name}_紫微命盘.json`, 'application/json')
}

const orderedPalaces = computed(() =>
  chart.value ? PALACE_ORDER.map((n) => chart.value!.palaces.find((p) => p.name === n)!).filter(Boolean) : [],
)

const chartText = computed(() => (chart.value ? chartToText(chart.value) : ''))
</script>

<template>
  <div class="page chart-page">
    <div v-if="loading" class="center-box"><NSpin size="large" /></div>
    <NResult v-else-if="error" status="warning" title="无法显示命盘" :description="error">
      <template #footer>
        <NButton type="primary" @click="router.push('/')">返回首页</NButton>
      </template>
    </NResult>
    <template v-else-if="record && chart">
      <div class="page-title serif">
        <span>{{ chart.basicInfo.name }} 的紫微命盘</span>
        <NTag size="small" :bordered="false">{{ chart.basicInfo.yinYangGender }}</NTag>
        <NTag size="small" :bordered="false" type="warning">{{ chart.basicInfo.fiveElements }}</NTag>
        <NTag v-if="isShare" size="small" type="info">分享命盘</NTag>
      </div>

      <div class="toolbar">
        <NButton v-if="!isShare" type="primary" @click="goAnalysis">
          <template #icon><Sparkles :size="16" /></template>
          AI 命理分析
        </NButton>
        <NButton v-if="isShare && !savedShare" type="primary" @click="saveShared">
          <template #icon><Save :size="16" /></template>
          保存到历史记录
        </NButton>
        <NButton v-if="!isShare" @click="editChart">
          <template #icon><Pencil :size="16" /></template>
          修改信息重排
        </NButton>
        <NButton @click="share">
          <template #icon><Share2 :size="16" /></template>
          分享命盘
        </NButton>
        <NDropdown :options="exportOptions" @select="onExport">
          <NButton>
            <template #icon><Download :size="16" /></template>
            导出命盘
          </NButton>
        </NDropdown>
        <NButton v-if="selectedPalace !== null" quaternary @click="selectedPalace = null">
          <template #icon><X :size="16" /></template>
          清除宫位高亮
        </NButton>
        <div class="grow" />
        <NRadioGroup v-model:value="viewMode" size="small">
          <NRadioButton value="grid"><LayoutGrid :size="14" /> 命盘</NRadioButton>
          <NRadioButton value="list"><List :size="14" /> 列表</NRadioButton>
        </NRadioGroup>
      </div>

      <NAlert v-if="chart.basicInfo.timeNotes.length" type="info" class="notes" :show-icon="false">
        <div v-for="n in chart.basicInfo.timeNotes" :key="n">{{ n }}</div>
        <div>
          原始钟表时间：{{ chart.basicInfo.solarDate }} {{ chart.basicInfo.clockTime }}
          <template v-if="chart.basicInfo.trueSolarTime">　→　真太阳时：{{ chart.basicInfo.trueSolarTime }}（{{ chart.basicInfo.timeBranch }}）</template>
        </div>
      </NAlert>

      <div class="layout">
        <div class="main">
          <ZiweiChart
            v-if="viewMode === 'grid'"
            :chart="chart"
            :selected-palace="selectedPalace"
            :decade-order="decadeOrder"
            :year="year"
            :theme="settings.general.appearance.chartTheme"
            @update:selected-palace="onSelectPalace"
          />
          <div v-else class="palace-list" :class="`chart-theme-${settings.general.appearance.chartTheme}`">
            <PalaceCard
              v-for="p in orderedPalaces"
              :key="p.index"
              :palace="p"
              :highlight="selectedPalace === p.index ? 'target' : null"
              @select="onSelectPalace"
            />
          </div>
          <p class="muted small">点击宫位查看详情并高亮三方四正（对宫、三合宫），同时显示本宫宫干四化飞入的宫位。在右侧选择大限、流年可叠加显示运限宫位与四化。</p>
        </div>
        <aside class="side">
          <NCard size="small" :bordered="false" title="大限与流年">
            <DecadePanel v-model:decade-order="decadeOrder" v-model:year="year" :chart="chart" />
          </NCard>
        </aside>
      </div>

      <NCard size="small" :bordered="false" class="text-card">
        <NCollapse>
          <NCollapseItem title="命盘文本（发送给大模型的命盘数据）" name="text">
            <pre class="chart-text">{{ chartText }}</pre>
          </NCollapseItem>
        </NCollapse>
      </NCard>

      <NDrawer v-model:show="drawer" :width="420" placement="right" style="max-width: 100vw">
        <NDrawerContent title="宫位详情" closable>
          <PalaceDetail v-if="selectedPalace !== null" :chart="chart" :index="selectedPalace" :decade-order="decadeOrder" :year="year" />
        </NDrawerContent>
      </NDrawer>
    </template>
  </div>
</template>

<style scoped>
.center-box {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}
.notes {
  margin-bottom: 12px;
  font-size: 0.9rem;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
  align-items: start;
}
.palace-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 8px;
}
.text-card {
  margin-top: 16px;
}
.chart-text {
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 0.8rem;
  max-height: 480px;
  overflow: auto;
  background: var(--bg);
  padding: 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
}
@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
