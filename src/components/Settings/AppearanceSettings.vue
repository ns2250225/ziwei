<script setup lang="ts">
import { NCard, NForm, NFormItem, NRadioGroup, NRadioButton, NSlider, NButton, useMessage, useDialog } from 'naive-ui'
import { Download, Trash2, Eraser } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { useReportStore } from '@/stores/report'
import { useChartStore } from '@/stores/chart'
import * as db from '@/database/indexedDB'
import { downloadText, formatDate } from '@/utils/common'

const settings = useSettingsStore()
const reportStore = useReportStore()
const chartStore = useChartStore()
const message = useMessage()
const dialog = useDialog()
const ap = settings.general.appearance

const chartThemes = [
  { value: 'classic', label: '古典', colors: ['#fffaf1', '#7c2d12', '#b91c1c'] },
  { value: 'ink', label: '水墨', colors: ['#f6f6f4', '#2b2b2b', '#111827'] },
  { value: 'cinnabar', label: '朱砂', colors: ['#fff4f0', '#9f1d1d', '#9f1d1d'] },
  { value: 'azure', label: '青黛', colors: ['#f1f6fa', '#1e3a5f', '#1e3a8a'] },
] as const

async function exportHistory() {
  const data = await db.exportAll()
  downloadText(JSON.stringify(data, null, 2), `紫微命理_历史记录_${formatDate(Date.now())}.json`, 'application/json')
  message.success('已导出（不含 API Key）')
}

function clearHistory() {
  dialog.error({
    title: '删除本地所有命盘和报告',
    content: '将删除本浏览器中保存的全部命盘、分析报告与任务记录，无法恢复。',
    positiveText: '全部删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      reportStore.stop()
      await db.clearAll()
      chartStore.recent = []
      reportStore.report = null
      message.success('已删除全部本地命盘和报告')
    },
  })
}

function clearEverything() {
  dialog.error({
    title: '清除全部本地数据',
    content: '将删除全部命盘、报告、API 配置（含 API Key）、提示词模板和外观设置，恢复为初始状态。',
    positiveText: '全部清除',
    negativeText: '取消',
    onPositiveClick: async () => {
      reportStore.stop()
      await db.clearAll()
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('ziwei.'))
          .forEach((k) => localStorage.removeItem(k))
      } catch {
        /* ignore */
      }
      location.reload()
    },
  })
}
</script>

<template>
  <div class="appearance">
    <NCard title="外观设置" size="small" :bordered="false">
      <NForm label-placement="left" label-width="110">
        <NFormItem label="主题模式">
          <NRadioGroup v-model:value="ap.theme">
            <NRadioButton value="light">浅色模式</NRadioButton>
            <NRadioButton value="dark">深色模式</NRadioButton>
            <NRadioButton value="auto">跟随系统</NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <NFormItem label="字体大小">
          <div class="slider">
            <NSlider v-model:value="ap.fontSize" :min="12" :max="20" :step="1" :marks="{ 12: '小', 15: '标准', 18: '大', 20: '特大' }" />
            <span class="val">{{ ap.fontSize }}px</span>
          </div>
        </NFormItem>
        <NFormItem label="报告阅读宽度">
          <NRadioGroup v-model:value="ap.readingWidth">
            <NRadioButton value="narrow">窄</NRadioButton>
            <NRadioButton value="medium">适中</NRadioButton>
            <NRadioButton value="wide">宽</NRadioButton>
            <NRadioButton value="full">铺满</NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <NFormItem label="命盘主题">
          <div class="themes">
            <button
              v-for="t in chartThemes"
              :key="t.value"
              class="theme"
              :class="{ active: ap.chartTheme === t.value }"
              @click="ap.chartTheme = t.value"
            >
              <span class="swatch" :style="{ background: t.colors[0], borderColor: t.colors[1] }">
                <i :style="{ color: t.colors[2] }">紫微</i>
              </span>
              {{ t.label }}
            </button>
          </div>
        </NFormItem>
        <NFormItem label="默认分析模式">
          <NRadioGroup v-model:value="settings.general.analysisMode">
            <NRadioButton value="staged">分阶段（推荐）</NRadioButton>
            <NRadioButton value="single">单次完整</NRadioButton>
          </NRadioGroup>
        </NFormItem>
      </NForm>
    </NCard>

    <NCard title="数据与隐私" size="small" :bordered="false" style="margin-top: 14px">
      <ul class="small privacy">
        <li>本站为纯前端应用，不上传出生信息到任何自建服务器；排盘计算完全在浏览器中完成。</li>
        <li>出生信息仅在你主动发起 AI 分析时发送给你配置的大模型服务，第三方模型服务可能处理并保存请求数据。</li>
        <li>命盘与报告保存在 IndexedDB，API 配置保存在 localStorage，API Key 与命盘、报告分开存储，不会写入报告、导出文件或分享链接。</li>
        <li>纯前端无法做到 API Key 绝对保密，本地存储并非加密保险箱；清除浏览器数据后历史记录将无法恢复。</li>
      </ul>
      <div class="ops">
        <NButton @click="exportHistory">
          <template #icon><Download :size="15" /></template>
          导出历史记录
        </NButton>
        <NButton type="error" secondary @click="clearHistory">
          <template #icon><Trash2 :size="15" /></template>
          删除所有命盘和报告
        </NButton>
        <NButton type="error" secondary @click="settings.clearAllApi(), message.success('已清除全部 API 配置')">
          <template #icon><Eraser :size="15" /></template>
          清除 API 配置
        </NButton>
        <NButton type="error" @click="clearEverything">清除全部本地数据</NButton>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.slider {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 420px;
  padding-bottom: 14px;
}
.val {
  white-space: nowrap;
  color: var(--text-muted);
}
.themes {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.theme {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 4px;
  cursor: pointer;
  color: var(--text);
}
.theme.active {
  border-color: var(--primary);
}
.swatch {
  width: 72px;
  height: 48px;
  border: 2px solid;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.swatch i {
  font-style: normal;
  font-weight: 700;
}
.privacy {
  margin: 0 0 12px;
  padding-left: 20px;
  line-height: 1.9;
}
.ops {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
