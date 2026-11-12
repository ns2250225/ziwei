<script setup lang="ts">
import { computed } from 'vue'
import { NProgress, NButton, NTag, NAlert } from 'naive-ui'
import { CircleCheck, CircleX, CircleDashed, LoaderCircle, CircleStop, RefreshCw, Play } from 'lucide-vue-next'
import type { SectionResult } from '@/types/report'
import { STAGE_LABELS } from '@/services/promptBuilder'
import { errorHint } from '@/services/aiClient'
import type { AiErrorKind } from '@/types/ai'

const props = defineProps<{
  sections: SectionResult[]
  running: boolean
  currentSectionId: string
  lastError: string
}>()
const emit = defineEmits<{ (e: 'stop'): void; (e: 'resume'): void; (e: 'restart'): void; (e: 'jump', id: string): void }>()

const done = computed(() => props.sections.filter((s) => s.status === 'done').length)
const total = computed(() => props.sections.length)
const percent = computed(() => (total.value ? Math.round((done.value / total.value) * 100) : 0))
const current = computed(() => props.sections.find((s) => s.id === props.currentSectionId))
const failed = computed(() => props.sections.filter((s) => s.status === 'failed'))
const failedHint = computed(() => {
  const kind = failed.value[0]?.errorKind as AiErrorKind | undefined
  return errorHint(kind)
})
const complete = computed(() => total.value > 0 && done.value === total.value)
</script>

<template>
  <div class="progress-box">
    <div class="top">
      <div class="info">
        <div class="line">
          <b v-if="running">正在分析</b>
          <b v-else-if="complete">分析已完成</b>
          <b v-else>分析未完成</b>
          <span class="muted small">已完成 {{ done }} / {{ total }} 个阶段</span>
        </div>
        <div v-if="running && current" class="line small">
          <span class="muted">当前阶段：</span>{{ STAGE_LABELS[current.stage] }}
          <span class="muted">　当前章节：</span>{{ current.title }}
          <span class="muted">　已生成 {{ current.content.length }} 字</span>
        </div>
      </div>
      <div class="btns">
        <NButton v-if="running" type="error" secondary size="small" @click="emit('stop')">
          <template #icon><CircleStop :size="15" /></template>
          停止生成
        </NButton>
        <NButton v-if="!running && !complete" type="primary" size="small" @click="emit('resume')">
          <template #icon><Play :size="15" /></template>
          继续分析
        </NButton>
        <NButton v-if="!running" size="small" @click="emit('restart')">
          <template #icon><RefreshCw :size="15" /></template>
          重新生成
        </NButton>
      </div>
    </div>
    <NProgress type="line" :percentage="percent" :processing="running" :height="8" :show-indicator="false" />
    <div class="stages">
      <button v-for="s in sections" :key="s.id" class="stage" :class="s.status" :title="s.title" @click="emit('jump', s.id)">
        <CircleCheck v-if="s.status === 'done'" :size="14" />
        <LoaderCircle v-else-if="s.status === 'running'" :size="14" class="spin" />
        <CircleX v-else-if="s.status === 'failed'" :size="14" />
        <CircleDashed v-else :size="14" />
        <span>{{ s.title.split('：')[0].replace(/（.*$/, '') }}{{ s.stage === 'decade' ? s.title.match(/第\d+(～\d+)?大限/)?.[0] ?? '' : '' }}</span>
        <NTag v-if="s.truncated" size="tiny" type="warning">截断</NTag>
      </button>
    </div>
    <NAlert v-if="!running && lastError" type="error" :show-icon="true" class="err">
      {{ lastError }}
      <div v-if="failedHint" class="small" style="margin-top: 4px">{{ failedHint }}</div>
    </NAlert>
  </div>
</template>

<style scoped>
.progress-box {
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.line {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: baseline;
}
.btns {
  display: flex;
  gap: 8px;
  align-items: center;
}
.stages {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.stage {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.stage.done {
  color: var(--mut-lu);
  border-color: var(--mut-lu);
}
.stage.running {
  color: var(--primary);
  border-color: var(--primary);
}
.stage.failed {
  color: var(--mut-ji);
  border-color: var(--mut-ji);
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.err {
  white-space: pre-wrap;
}
</style>
