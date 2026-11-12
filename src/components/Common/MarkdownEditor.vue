<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NButtonGroup, NRadioGroup, NRadioButton, NTooltip } from 'naive-ui'
import { renderMarkdownSimple } from '@/utils/markdown'

const props = withDefaults(defineProps<{ modelValue: string; rows?: number; placeholder?: string; variables?: string[] }>(), {
  rows: 22,
  placeholder: '',
  variables: () => [],
})
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const mode = ref<'edit' | 'split' | 'preview'>(window.innerWidth < 900 ? 'edit' : 'split')
const ta = ref<HTMLTextAreaElement | null>(null)
const preview = computed(() => renderMarkdownSimple(props.modelValue))

function update(v: string) {
  emit('update:modelValue', v)
}

/** 在光标处插入/包裹文本 */
function insert(before: string, after = '', placeholder = '') {
  const el = ta.value
  if (!el) {
    update(props.modelValue + before + placeholder + after)
    return
  }
  const start = el.selectionStart
  const end = el.selectionEnd
  const selected = props.modelValue.slice(start, end) || placeholder
  const next = props.modelValue.slice(0, start) + before + selected + after + props.modelValue.slice(end)
  update(next)
  requestAnimationFrame(() => {
    el.focus()
    el.selectionStart = start + before.length
    el.selectionEnd = start + before.length + selected.length
  })
}

function linePrefix(prefix: string) {
  const el = ta.value
  if (!el) return
  const start = props.modelValue.lastIndexOf('\n', el.selectionStart - 1) + 1
  update(props.modelValue.slice(0, start) + prefix + props.modelValue.slice(start))
  requestAnimationFrame(() => {
    el.focus()
    el.selectionStart = el.selectionEnd = el.selectionStart + prefix.length
  })
}

const tools = [
  { label: 'H2', tip: '二级标题', fn: () => linePrefix('## ') },
  { label: 'H3', tip: '三级标题', fn: () => linePrefix('### ') },
  { label: 'B', tip: '加粗', fn: () => insert('**', '**', '加粗文本') },
  { label: '•', tip: '无序列表', fn: () => linePrefix('- ') },
  { label: '1.', tip: '有序列表', fn: () => linePrefix('1. ') },
  { label: '❝', tip: '引用', fn: () => linePrefix('> ') },
  { label: '表格', tip: '插入表格', fn: () => insert('\n| 项目 | 内容 |\n| --- | --- |\n| ', ' |  |\n', '示例') },
  { label: '—', tip: '分割线', fn: () => insert('\n---\n') },
]

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault()
    insert('  ')
  }
}
</script>

<template>
  <div class="md-editor">
    <div class="bar">
      <NButtonGroup size="tiny">
        <NTooltip v-for="t in tools" :key="t.label">
          <template #trigger>
            <NButton :disabled="mode === 'preview'" @click="t.fn">{{ t.label }}</NButton>
          </template>
          {{ t.tip }}
        </NTooltip>
      </NButtonGroup>
      <NButtonGroup v-if="variables.length" size="tiny">
        <NButton v-for="v in variables" :key="v" :disabled="mode === 'preview'" @click="insert(v)">{{ v }}</NButton>
      </NButtonGroup>
      <div class="grow" />
      <NRadioGroup v-model:value="mode" size="small">
        <NRadioButton value="edit">编辑</NRadioButton>
        <NRadioButton value="split">分屏</NRadioButton>
        <NRadioButton value="preview">预览</NRadioButton>
      </NRadioGroup>
    </div>
    <div class="body" :class="mode">
      <textarea
        v-show="mode !== 'preview'"
        ref="ta"
        class="src"
        :rows="rows"
        :value="modelValue"
        :placeholder="placeholder"
        spellcheck="false"
        @input="update(($event.target as HTMLTextAreaElement).value)"
        @keydown="onKeydown"
      />
      <div v-show="mode !== 'edit'" class="pv markdown-body" :style="{ maxHeight: `${rows * 1.6 + 1}em` }" v-html="preview" />
    </div>
    <div class="muted small count">{{ modelValue.length }} 字符</div>
  </div>
</template>

<style scoped>
.md-editor {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-elevated);
}
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.body {
  display: grid;
  grid-template-columns: 1fr;
}
.body.split {
  grid-template-columns: 1fr 1fr;
}
.src {
  width: 100%;
  border: none;
  outline: none;
  resize: vertical;
  padding: 10px 12px;
  font-family: Consolas, 'Courier New', 'Microsoft YaHei', monospace;
  font-size: 0.86rem;
  line-height: 1.6;
  background: transparent;
  color: var(--text);
}
.split .src {
  border-right: 1px solid var(--border);
}
.pv {
  padding: 8px 14px;
  overflow: auto;
  font-size: 0.9rem;
}
.count {
  text-align: right;
  padding: 2px 8px 4px;
}
@media (max-width: 900px) {
  .body.split {
    grid-template-columns: 1fr;
  }
  .split .src {
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
}
</style>
