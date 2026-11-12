<script setup lang="ts">
import { NButton, NTag, NAlert, NEmpty } from 'naive-ui'
import { RotateCcw } from 'lucide-vue-next'
import type { RenderedSection } from '@/types/reportView'
import { STAGE_LABELS } from '@/services/promptBuilder'
import { errorHint } from '@/services/aiClient'
import type { AiErrorKind } from '@/types/ai'

defineProps<{ items: RenderedSection[]; running: boolean; currentSectionId: string }>()
const emit = defineEmits<{ (e: 'retry', id: string): void }>()

const statusText = { pending: '待生成', running: '生成中', done: '已完成', failed: '未完成' }
const statusType = { pending: 'default', running: 'info', done: 'success', failed: 'error' } as const
</script>

<template>
  <div class="report-viewer">
    <NEmpty v-if="!items.length" description="暂无报告内容" />
    <section v-for="it in items" :id="`sec-${it.section.id}`" :key="it.section.id" class="sec">
      <header class="sec-head">
        <div class="sec-title">
          <span class="stage muted small">{{ STAGE_LABELS[it.section.stage] }}</span>
          <span class="t">{{ it.section.title }}</span>
        </div>
        <div class="sec-actions">
          <NTag size="small" :type="statusType[it.section.status]" :bordered="false">{{ statusText[it.section.status] }}</NTag>
          <NTag v-if="it.section.truncated" size="small" type="warning" :bordered="false">输出可能被截断</NTag>
          <NButton
            size="tiny"
            secondary
            :disabled="running"
            title="单独重新生成本章节"
            @click="emit('retry', it.section.id)"
          >
            <template #icon><RotateCcw :size="13" /></template>
            {{ it.section.status === 'pending' ? '生成本章' : '重试本章' }}
          </NButton>
        </div>
      </header>
      <NAlert v-if="it.section.status === 'failed' && it.section.error" type="error" class="sec-err" :show-icon="false">
        {{ it.section.error }}
        <div v-if="errorHint(it.section.errorKind as AiErrorKind)" class="small">{{ errorHint(it.section.errorKind as AiErrorKind) }}</div>
      </NAlert>
      <NAlert v-if="it.failed" type="warning" class="sec-err" :show-icon="false">Markdown 解析失败，已降级显示原始文本。</NAlert>
      <div
        v-if="it.section.content"
        class="markdown-body"
        :class="{ 'blink-cursor': running && currentSectionId === it.section.id }"
        v-html="it.html"
      />
      <div v-else-if="it.section.status === 'running'" class="muted waiting blink-cursor">正在等待模型响应</div>
      <div v-else-if="it.section.status === 'pending'" class="muted small waiting">本章节尚未生成</div>
    </section>
  </div>
</template>

<style scoped>
.report-viewer {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.sec {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 20px 18px;
  scroll-margin-top: 76px;
}
.sec-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
  border-bottom: 1px dashed var(--border);
  padding-bottom: 8px;
  margin-bottom: 6px;
}
.sec-title {
  display: flex;
  flex-direction: column;
}
.sec-title .t {
  font-weight: 700;
}
.sec-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.sec-err {
  margin: 8px 0;
}
.waiting {
  padding: 12px 0;
}
@media (max-width: 640px) {
  .sec {
    padding: 12px 12px 14px;
  }
}
</style>
