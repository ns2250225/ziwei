<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton,
  NCard,
  NInput,
  NSelect,
  NTabs,
  NTabPane,
  NTag,
  NAlert,
  NRadioGroup,
  NRadioButton,
  NDropdown,
  NSpace,
  useDialog,
  useMessage,
} from 'naive-ui'
import { Plus, Copy, Trash2, Save, RotateCcw, Upload, Download, Star, ArrowLeft, Undo2 } from 'lucide-vue-next'
import MarkdownEditor from '@/components/Common/MarkdownEditor.vue'
import type { AnalysisMode, PromptTemplate } from '@/types/report'
import type { ChartData } from '@/types/chart'
import { useSettingsStore } from '@/stores/settings'
import { computeChart, exampleBirthInput } from '@/stores/chart'
import { createDefaultTemplate, DEFAULT_TEMPLATE_ID, PROMPT_VARIABLES } from '@/prompts/default'
import { previewPrompt, STAGE_LABELS } from '@/services/promptBuilder'
import { listCharts } from '@/database/indexedDB'
import { downloadText, pickFile, readFileText, safeFileName, toPlain, uid } from '@/utils/common'

const settings = useSettingsStore()
const route = useRoute()
const router = useRouter()
const dialog = useDialog()
const message = useMessage()

const selectedId = ref<string>(String(route.query.template || settings.defaultTemplate.id))
const draft = ref<PromptTemplate>(toPlain(settings.getTemplate(selectedId.value)))
const backPath = computed(() => (route.query.back ? String(route.query.back) : ''))

const current = computed(() => settings.templates.find((t) => t.id === selectedId.value))
const dirty = computed(() => !!current.value && JSON.stringify(current.value) !== JSON.stringify(draft.value))

function select(id: string) {
  const go = () => {
    selectedId.value = id
    draft.value = toPlain(settings.getTemplate(id))
  }
  if (dirty.value) {
    dialog.warning({
      title: '有未保存的修改',
      content: '切换模板将丢弃当前未保存的修改，确定切换吗？',
      positiveText: '丢弃并切换',
      negativeText: '取消',
      onPositiveClick: go,
    })
  } else go()
}

const templateOptions = computed(() =>
  settings.templates.map((t) => ({
    label: `${t.name}${t.builtin ? '（内置）' : ''}${settings.defaultTemplate.id === t.id ? ' · 默认' : ''}`,
    value: t.id,
  })),
)

function save() {
  if (!draft.value.name.trim()) {
    message.warning('请填写模板名称')
    return
  }
  settings.upsertTemplate(toPlain(draft.value))
  draft.value = toPlain(settings.getTemplate(draft.value.id))
  message.success('模板已保存')
}

function saveAndRestart() {
  if (!draft.value.name.trim()) {
    message.warning('请填写模板名称')
    return
  }
  settings.upsertTemplate(toPlain(draft.value))
  router.push({ path: backPath.value.split('?')[0], query: { action: 'restart', template: draft.value.id } })
}

function revert() {
  draft.value = toPlain(settings.getTemplate(selectedId.value))
}

function createNew(fromCurrent: boolean) {
  const base = fromCurrent ? toPlain(draft.value) : createDefaultTemplate()
  const t: PromptTemplate = {
    ...base,
    id: uid('tpl_'),
    name: fromCurrent ? `${base.name} 副本` : `自定义模板 ${settings.templates.length}`,
    builtin: false,
    updatedAt: Date.now(),
  }
  settings.upsertTemplate(t)
  selectedId.value = t.id
  draft.value = toPlain(t)
  message.success('已创建新模板')
}

function remove() {
  if (!current.value || current.value.builtin) return
  dialog.warning({
    title: '删除模板',
    content: `确定删除模板「${current.value.name}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      settings.removeTemplate(selectedId.value)
      selectedId.value = settings.defaultTemplate.id
      draft.value = toPlain(settings.defaultTemplate)
      message.success('已删除')
    },
  })
}

function restoreDefault() {
  dialog.warning({
    title: '恢复默认提示词',
    content:
      selectedId.value === DEFAULT_TEMPLATE_ID
        ? '将内置默认模板恢复为出厂内容，你对内置模板的修改将丢失。'
        : '将用出厂默认提示词覆盖当前模板编辑区的内容（保留模板名称），保存后生效。',
    positiveText: '恢复',
    negativeText: '取消',
    onPositiveClick: () => {
      if (selectedId.value === DEFAULT_TEMPLATE_ID) {
        const fresh = settings.resetBuiltinTemplate()
        draft.value = toPlain(fresh)
      } else {
        const fresh = createDefaultTemplate()
        draft.value = { ...draft.value, system: fresh.system, content: fresh.content, stages: fresh.stages, customItems: '' }
      }
      message.success('已恢复默认提示词')
    },
  })
}

function setDefault() {
  settings.general.defaultTemplateId = selectedId.value
  message.success('已设为默认模板')
}

/* ---------- 导入导出 ---------- */
function exportCurrent() {
  downloadText(JSON.stringify({ app: 'ziwei-ai-prompt', templates: [draft.value] }, null, 2), `提示词_${safeFileName(draft.value.name)}.json`, 'application/json')
}
function exportAll() {
  downloadText(JSON.stringify({ app: 'ziwei-ai-prompt', templates: settings.templates }, null, 2), '提示词模板_全部.json', 'application/json')
}
function exportMd() {
  downloadText(draft.value.content, `提示词_${safeFileName(draft.value.name)}.md`, 'text/markdown;charset=utf-8')
}
const exportOptions = [
  { label: '导出当前模板（JSON）', key: 'one' },
  { label: '导出当前完整提示词（Markdown）', key: 'md' },
  { label: '导出全部模板（JSON）', key: 'all' },
]
function onExport(k: string) {
  if (k === 'one') exportCurrent()
  else if (k === 'md') exportMd()
  else exportAll()
}

async function importFile() {
  const file = await pickFile('.json,.md,.txt,application/json,text/markdown,text/plain')
  if (!file) return
  try {
    const text = await readFileText(file)
    const fresh = createDefaultTemplate()
    if (/\.json$/i.test(file.name)) {
      const data = JSON.parse(text)
      const list: Partial<PromptTemplate>[] = Array.isArray(data) ? data : Array.isArray(data?.templates) ? data.templates : [data]
      let n = 0
      let lastId = ''
      for (const t of list) {
        if (!t || typeof t.content !== 'string') continue
        const tpl: PromptTemplate = {
          ...fresh,
          ...t,
          stages: { ...fresh.stages, ...(t.stages ?? {}) },
          id: uid('tpl_'),
          name: t.name ? `${t.name}（导入）` : `导入模板 ${n + 1}`,
          builtin: false,
          customItems: t.customItems ?? '',
          system: t.system ?? fresh.system,
          updatedAt: Date.now(),
        }
        settings.upsertTemplate(tpl)
        lastId = tpl.id
        n++
      }
      if (!n) throw new Error('文件中没有有效的提示词模板')
      selectedId.value = lastId
      draft.value = toPlain(settings.getTemplate(lastId))
      message.success(`已导入 ${n} 个模板`)
    } else {
      const tpl: PromptTemplate = {
        ...fresh,
        id: uid('tpl_'),
        name: file.name.replace(/\.(md|txt)$/i, ''),
        builtin: false,
        content: text.includes('{{CHART_DATA}}') ? text : `${text}\n\n## 命盘信息\n\n{{CHART_DATA}}\n`,
        updatedAt: Date.now(),
      }
      settings.upsertTemplate(tpl)
      selectedId.value = tpl.id
      draft.value = toPlain(tpl)
      message.success('已导入 Markdown 提示词为新模板')
    }
  } catch (e) {
    message.error(`导入失败：${(e as Error).message}`)
  }
}

/* ---------- 预览 ---------- */
const previewChart = ref<ChartData | null>(null)
const previewChartName = ref('')
const previewMode = ref<AnalysisMode>(settings.general.analysisMode)
const previewSection = ref('')
async function ensurePreviewChart() {
  if (previewChart.value) return
  try {
    const list = await listCharts()
    if (list.length) {
      previewChart.value = list[0].chartData
      previewChartName.value = `最近命盘：${list[0].basicInfo.name}`
      return
    }
  } catch {
    /* ignore */
  }
  previewChart.value = computeChart(exampleBirthInput()).chartData
  previewChartName.value = '示例命盘'
}
const tab = ref('content')
watch(tab, (t) => {
  if (t === 'preview') ensurePreviewChart()
})
const previewList = computed(() => (previewChart.value ? previewPrompt(previewChart.value, draft.value, previewMode.value) : []))
watch(previewList, (l) => {
  if (l.length && !l.some((x) => x.section.id === previewSection.value)) previewSection.value = l[0].section.id
})
const previewItem = computed(() => previewList.value.find((x) => x.section.id === previewSection.value))
const previewOptions = computed(() => previewList.value.map((x) => ({ label: x.section.title, value: x.section.id })))

const stageFields: { key: keyof PromptTemplate['stages']; label: string; desc: string }[] = [
  { key: 'basic', label: '原局 / 十二宫分析规则', desc: '第一阶段：命盘基本信息、命格、十二宫、三方四正、四化（章节 01～06）' },
  { key: 'life', label: '人生领域分析规则', desc: '第二阶段：性格、学业事业、财富、婚姻、人际、健康（章节 07～12）' },
  { key: 'decade', label: '大限分析规则', desc: '第三阶段：十二大限（分两批），可用 {{DECADE_FROM}} {{DECADE_TO}} {{DECADE_LIST}}' },
  { key: 'annual', label: '流年分析规则', desc: '第四阶段：前八大限 80 个流年（每大限一批），可用 {{DECADE_NO}} {{YEAR_FROM}} {{YEAR_TO}} {{ANNUAL_DATA}} 等' },
  { key: 'summary', label: '关键事件与总结规则', desc: '第五阶段：关键事件汇总与综合建议，可用 {{PREVIOUS_RESULTS}}' },
  { key: 'custom', label: '自定义项目阶段规则', desc: '仅当填写了自定义分析项目时执行，可用 {{CUSTOM_ITEMS}}' },
]
const stageTab = ref<keyof PromptTemplate['stages']>('basic')

const VARS_FOR_EDITOR = ['{{CHART_DATA}}', '{{NAME}}', '{{CUSTOM_ITEMS}}']
</script>

<template>
  <div class="prompt-settings">
    <div class="topbar">
      <NButton v-if="backPath" secondary @click="router.push(backPath)">
        <template #icon><ArrowLeft :size="15" /></template>
        返回分析
      </NButton>
      <NSelect :value="selectedId" :options="templateOptions" style="width: 280px" @update:value="select" />
      <NTag v-if="dirty" type="warning" size="small">未保存</NTag>
      <div class="grow" />
      <NSpace :size="6" wrap>
        <NButton size="small" @click="createNew(false)">
          <template #icon><Plus :size="14" /></template>
          新建模板
        </NButton>
        <NButton size="small" @click="createNew(true)">
          <template #icon><Copy :size="14" /></template>
          复制当前
        </NButton>
        <NButton size="small" :disabled="settings.defaultTemplate.id === selectedId" @click="setDefault">
          <template #icon><Star :size="14" /></template>
          设为默认
        </NButton>
        <NButton size="small" @click="importFile">
          <template #icon><Upload :size="14" /></template>
          导入
        </NButton>
        <NDropdown :options="exportOptions" @select="onExport">
          <NButton size="small">
            <template #icon><Download :size="14" /></template>
            导出
          </NButton>
        </NDropdown>
        <NButton size="small" @click="restoreDefault">
          <template #icon><RotateCcw :size="14" /></template>
          恢复默认
        </NButton>
        <NButton size="small" type="error" quaternary :disabled="!current || current.builtin" @click="remove">
          <template #icon><Trash2 :size="14" /></template>
          删除
        </NButton>
      </NSpace>
    </div>

    <NCard size="small" :bordered="false">
      <div class="name-row">
        <span class="muted">模板名称</span>
        <NInput v-model:value="draft.name" style="max-width: 360px" maxlength="40" />
      </div>

      <NTabs v-model:value="tab" type="line" animated>
        <NTabPane name="content" tab="完整提示词">
          <p class="muted small">
            单次完整分析时直接发送此提示词；分阶段分析时，此提示词作为整体口径，并在末尾追加各阶段指令。使用
            <code v-pre>{{CHART_DATA}}</code> 标记命盘数据插入位置。
          </p>
          <MarkdownEditor v-model="draft.content" :rows="26" :variables="VARS_FOR_EDITOR" />
        </NTabPane>
        <NTabPane name="system" tab="系统角色">
          <p class="muted small">作为 system 消息发送，定义模型扮演的角色与输出约束。</p>
          <NInput v-model:value="draft.system" type="textarea" :autosize="{ minRows: 6, maxRows: 16 }" placeholder="例如：你是一位资深紫微斗数研究专家……" />
        </NTabPane>
        <NTabPane name="stages" tab="分阶段规则">
          <p class="muted small">分阶段分析时，每个阶段使用独立的指令，可分别修改十二宫、大限、流年等分析规则。</p>
          <NRadioGroup v-model:value="stageTab" size="small" class="stage-tabs">
            <NRadioButton v-for="f in stageFields" :key="f.key" :value="f.key">{{ f.label }}</NRadioButton>
          </NRadioGroup>
          <template v-for="f in stageFields" :key="f.key">
            <div v-if="stageTab === f.key">
              <div class="muted small" style="margin: 8px 0">{{ f.desc }}</div>
              <MarkdownEditor v-model="draft.stages[f.key]" :rows="20" />
            </div>
          </template>
        </NTabPane>
        <NTabPane name="custom" tab="自定义分析项目">
          <p class="muted small">
            填写你额外关心的分析项目（每行一项），例如“2026 年是否适合创业”“适合的居住方位”。单次分析时追加到提示词末尾；分阶段分析时会增加一个独立的“自定义分析”阶段。
          </p>
          <NInput
            v-model:value="draft.customItems"
            type="textarea"
            :autosize="{ minRows: 6, maxRows: 16 }"
            placeholder="1. 适合从事的具体行业&#10;2. 近三年的置业时机&#10;3. ……"
          />
        </NTabPane>
        <NTabPane name="vars" tab="变量说明">
          <table class="vars">
            <tr v-for="v in PROMPT_VARIABLES" :key="v.key">
              <td><code>{{ v.key }}</code></td>
              <td>{{ v.desc }}</td>
            </tr>
          </table>
        </NTabPane>
        <NTabPane name="preview" tab="预览最终提示词">
          <div class="preview-bar">
            <span class="muted small">{{ previewChartName }}</span>
            <NRadioGroup v-model:value="previewMode" size="small">
              <NRadioButton value="staged">分阶段</NRadioButton>
              <NRadioButton value="single">单次完整</NRadioButton>
            </NRadioGroup>
            <NSelect v-model:value="previewSection" :options="previewOptions" size="small" style="width: 320px; max-width: 100%" />
          </div>
          <NAlert v-if="dirty" type="info" :show-icon="false" class="small" style="margin: 8px 0">预览基于当前编辑内容（尚未保存）。</NAlert>
          <div v-if="previewItem" class="preview">
            <div class="muted small">
              {{ STAGE_LABELS[previewItem.section.stage] }} · 共 {{ previewItem.messages.reduce((n, m) => n + m.content.length, 0) }} 字
            </div>
            <div v-for="(m, i) in previewItem.messages" :key="i" class="msg">
              <div class="role">{{ m.role }}</div>
              <pre>{{ m.content }}</pre>
            </div>
          </div>
        </NTabPane>
      </NTabs>

      <div class="save-bar">
        <NButton type="primary" :disabled="!dirty" @click="save">
          <template #icon><Save :size="15" /></template>
          保存模板
        </NButton>
        <NButton :disabled="!dirty" @click="revert">
          <template #icon><Undo2 :size="15" /></template>
          撤销修改
        </NButton>
        <NButton v-if="backPath" type="primary" secondary @click="saveAndRestart">
          保存并重新分析
        </NButton>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.stage-tabs {
  flex-wrap: wrap;
}
.vars {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.9rem;
}
.vars td {
  border-bottom: 1px solid var(--border);
  padding: 6px 8px;
}
.preview-bar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.preview {
  max-height: 70vh;
  overflow: auto;
  margin-top: 8px;
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
.save-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
  position: sticky;
  bottom: 0;
  padding: 10px 0 4px;
  background: var(--bg-elevated);
}
</style>
