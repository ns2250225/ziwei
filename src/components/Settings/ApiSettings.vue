<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  NButton,
  NCard,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSwitch,
  NSelect,
  NRadioGroup,
  NRadioButton,
  NSlider,
  NAlert,
  NTag,
  NEmpty,
  NSpace,
  NCollapse,
  NCollapseItem,
  useDialog,
  useMessage,
} from 'naive-ui'
import { Plus, Pencil, Trash2, Zap, Star, ShieldAlert, Eraser } from 'lucide-vue-next'
import type { ApiConfig } from '@/types/ai'
import { createApiConfig, useSettingsStore } from '@/stores/settings'
import { errorHint, resolveEndpoint, testConnection, type TestResult } from '@/services/aiClient'

const settings = useSettingsStore()
const dialog = useDialog()
const message = useMessage()

const PRESETS: { name: string; url: string; urlMode: 'base' | 'full'; model: string; tokenParam?: ApiConfig['tokenParam'] }[] = [
  { name: 'OpenAI', url: 'https://api.openai.com/v1', urlMode: 'base', model: 'gpt-4o' },
  { name: 'DeepSeek', url: 'https://api.deepseek.com', urlMode: 'base', model: 'deepseek-chat' },
  { name: '阿里云百炼（通义）', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', urlMode: 'base', model: 'qwen-plus' },
  { name: '月之暗面 Kimi', url: 'https://api.moonshot.cn/v1', urlMode: 'base', model: 'moonshot-v1-128k' },
  { name: '智谱 GLM', url: 'https://open.bigmodel.cn/api/paas/v4', urlMode: 'base', model: 'glm-4-plus' },
  { name: '硅基流动', url: 'https://api.siliconflow.cn/v1', urlMode: 'base', model: 'deepseek-ai/DeepSeek-V3' },
  { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', urlMode: 'base', model: 'anthropic/claude-sonnet-4' },
  { name: 'Ollama（本地）', url: 'http://localhost:11434/v1', urlMode: 'base', model: 'qwen2.5:14b' },
]

const editorOpen = ref(false)
const editing = ref<ApiConfig>(createApiConfig())
const isNew = ref(true)
const showKey = ref(false)

function openNew() {
  editing.value = createApiConfig({ name: `配置 ${settings.apiConfigs.length + 1}` })
  isNew.value = true
  testResult.value = null
  showKey.value = false
  editorOpen.value = true
}
function openEdit(c: ApiConfig) {
  editing.value = { ...c }
  isNew.value = false
  testResult.value = null
  showKey.value = false
  editorOpen.value = true
}
function applyPreset(p: (typeof PRESETS)[number]) {
  editing.value.url = p.url
  editing.value.urlMode = p.urlMode
  editing.value.model = p.model
  if (p.tokenParam) editing.value.tokenParam = p.tokenParam
  if (editing.value.name.startsWith('配置') || editing.value.name === '我的模型') editing.value.name = p.name
}

const endpointPreview = computed(() => resolveEndpoint(editing.value))

function validate(c: ApiConfig): string | null {
  if (!c.name.trim()) return '请填写配置名称'
  if (!c.url.trim()) return '请填写 API URL'
  try {
    const u = new URL(resolveEndpoint(c))
    if (!/^https?:$/.test(u.protocol)) return 'API URL 需以 http:// 或 https:// 开头'
  } catch {
    return 'API URL 格式错误'
  }
  if (/[?&](key|api_key|apikey|token)=/i.test(c.url)) return '不允许将 API Key 写入 URL，请填写在 API Key 字段中'
  if (!c.model.trim()) return '请填写模型名称'
  if (c.extraHeaders.trim()) {
    try {
      const o = JSON.parse(c.extraHeaders)
      if (typeof o !== 'object' || Array.isArray(o)) return '额外请求头需为 JSON 对象'
    } catch {
      return '额外请求头不是合法的 JSON'
    }
  }
  return null
}

function save() {
  const err = validate(editing.value)
  if (err) {
    message.warning(err)
    return
  }
  editing.value.url = editing.value.url.trim()
  editing.value.model = editing.value.model.trim()
  editing.value.apiKey = editing.value.apiKey.trim()
  settings.upsertApi(editing.value)
  editorOpen.value = false
  message.success('已保存')
}

function remove(c: ApiConfig) {
  dialog.warning({
    title: '删除 API 配置',
    content: `确定删除「${c.name}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      settings.removeApi(c.id)
      message.success('已删除')
    },
  })
}

function clearAll() {
  dialog.error({
    title: '一键清除 API 配置',
    content: '将删除本地保存的全部 API 配置与 API Key，此操作不可恢复。',
    positiveText: '全部清除',
    negativeText: '取消',
    onPositiveClick: () => {
      settings.clearAllApi()
      message.success('已清除全部 API 配置')
    },
  })
}

/* ---------- 测试 ---------- */
const testing = ref(false)
const testResult = ref<TestResult | null>(null)
const testingId = ref('')
let testCtrl: AbortController | null = null

async function runTest(cfg: ApiConfig) {
  const err = validate(cfg)
  if (err) {
    message.warning(err)
    return
  }
  testCtrl?.abort()
  testCtrl = new AbortController()
  testing.value = true
  testingId.value = cfg.id
  testResult.value = null
  try {
    testResult.value = await testConnection(cfg, testCtrl.signal)
  } finally {
    testing.value = false
  }
}

const listTest = ref<Record<string, TestResult>>({})
async function quickTest(c: ApiConfig) {
  testingId.value = c.id
  testing.value = true
  try {
    listTest.value = { ...listTest.value, [c.id]: await testConnection(c) }
  } finally {
    testing.value = false
    testingId.value = ''
  }
}

const mask = (k: string) => (!k ? '未填写' : k.length <= 8 ? '••••••' : `${k.slice(0, 3)}••••••${k.slice(-4)}`)
</script>

<template>
  <div class="api-settings">
    <NAlert type="warning" class="tip">
      <template #icon><ShieldAlert :size="20" /></template>
      API Key 保存在本浏览器的 localStorage 中（与命盘、报告数据分开存储，不会写入报告或分享链接），但本地存储并非加密保险箱，请勿在公共电脑上保存密钥。纯前端调用要求服务商允许浏览器跨域（CORS），否则需使用兼容代理。
    </NAlert>

    <div class="head">
      <NButton type="primary" @click="openNew">
        <template #icon><Plus :size="16" /></template>
        添加 API 配置
      </NButton>
      <NButton type="error" quaternary :disabled="!settings.apiConfigs.length" @click="clearAll">
        <template #icon><Eraser :size="16" /></template>
        一键清除配置
      </NButton>
    </div>

    <NEmpty v-if="!settings.apiConfigs.length" description="尚未添加任何 API 配置" style="padding: 40px 0">
      <template #extra>
        <NButton type="primary" @click="openNew">添加第一个配置</NButton>
      </template>
    </NEmpty>

    <div class="list">
      <NCard v-for="c in settings.apiConfigs" :key="c.id" size="small" class="item" :class="{ def: settings.defaultApi?.id === c.id }">
        <div class="item-head">
          <b>{{ c.name }}</b>
          <NTag v-if="settings.defaultApi?.id === c.id" size="small" type="primary">默认</NTag>
          <NTag size="small" :bordered="false">{{ c.model }}</NTag>
          <NTag size="small" :bordered="false">{{ c.stream ? '流式' : '非流式' }}</NTag>
        </div>
        <div class="muted small mono">{{ resolveEndpoint(c) }}</div>
        <div class="muted small">
          Key：{{ mask(c.apiKey) }} · Temperature {{ c.sendTemperature ? c.temperature : '不发送' }} · Max Tokens {{ c.tokenParam === 'none' ? '不发送' : c.maxTokens }} · Top P
          {{ c.sendTopP ? c.topP : '不发送' }}
        </div>
        <div v-if="listTest[c.id]" class="small" :class="listTest[c.id].ok ? 'ok' : 'bad'">
          {{ listTest[c.id].ok ? `连接成功（${listTest[c.id].latency}ms）：${listTest[c.id].content.slice(0, 80)}` : listTest[c.id].error }}
        </div>
        <NSpace class="ops" :size="6">
          <NButton size="small" :loading="testing && testingId === c.id" @click="quickTest(c)">
            <template #icon><Zap :size="14" /></template>
            测试
          </NButton>
          <NButton size="small" @click="openEdit(c)">
            <template #icon><Pencil :size="14" /></template>
            编辑
          </NButton>
          <NButton v-if="settings.defaultApi?.id !== c.id" size="small" @click="settings.setDefaultApi(c.id)">
            <template #icon><Star :size="14" /></template>
            设为默认
          </NButton>
          <NButton size="small" type="error" quaternary @click="remove(c)">
            <template #icon><Trash2 :size="14" /></template>
            删除
          </NButton>
        </NSpace>
      </NCard>
    </div>

    <NCollapse class="notes">
      <NCollapseItem title="接口兼容说明" name="compat">
        <ul class="small">
          <li>优先支持 OpenAI Chat Completions 兼容接口（POST /v1/chat/completions，Bearer 鉴权）。</li>
          <li>“完整地址”模式按原样请求；“Base URL”模式会自动补全：以 /chat/completions 结尾则不变，以 /v1、/v4 等版本号结尾则补 /chat/completions，否则补 /v1/chat/completions，避免重复拼接。</li>
          <li>部分模型（如推理模型）不支持自定义 Temperature / Top P，可关闭发送；若接口返回参数错误，系统也会自动去掉这两个参数重试一次。</li>
          <li>部分服务商使用 max_completion_tokens 代替 max_tokens，可在 Token 参数中切换，或选择“不发送”。</li>
          <li>流式响应兼容标准 SSE（data: ...）、NDJSON 以及 reasoning_content 字段；若服务返回非流式 JSON 也会自动识别。</li>
          <li>若出现“网络请求失败”，通常是服务商未开放浏览器跨域（CORS），可使用支持 CORS 的中转服务（如自建 One API / New API）。</li>
        </ul>
      </NCollapseItem>
    </NCollapse>

    <NModal v-model:show="editorOpen" preset="card" :title="isNew ? '添加 API 配置' : '编辑 API 配置'" style="width: min(760px, 96vw)" :mask-closable="false">
      <div class="presets">
        <span class="muted small">快速填充：</span>
        <NButton v-for="p in PRESETS" :key="p.name" size="tiny" secondary @click="applyPreset(p)">{{ p.name }}</NButton>
      </div>
      <NForm label-placement="left" label-width="110" size="small">
        <NFormItem label="配置名称" required>
          <NInput v-model:value="editing.name" placeholder="自定义配置名称" />
        </NFormItem>
        <NFormItem label="URL 模式">
          <NRadioGroup v-model:value="editing.urlMode">
            <NRadioButton value="base">Base URL 自动补全</NRadioButton>
            <NRadioButton value="full">完整接口地址</NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <NFormItem label="API URL" required>
          <div class="col">
            <NInput v-model:value="editing.url" :placeholder="editing.urlMode === 'base' ? 'https://api.openai.com/v1' : 'https://api.openai.com/v1/chat/completions'" />
            <div class="muted small mono">实际请求：{{ endpointPreview || '—' }}</div>
          </div>
        </NFormItem>
        <NFormItem label="API Key">
          <NInput
            v-model:value="editing.apiKey"
            :type="showKey ? 'text' : 'password'"
            show-password-on="click"
            placeholder="sk-...（本地模型可留空）"
            autocomplete="off"
            :input-props="{ autocomplete: 'new-password' }"
          />
        </NFormItem>
        <NFormItem label="Model" required>
          <NInput v-model:value="editing.model" placeholder="模型名称，如 gpt-4o / deepseek-chat" />
        </NFormItem>
        <NFormItem label="Temperature">
          <div class="param">
            <NSwitch v-model:value="editing.sendTemperature" size="small" />
            <NSlider v-model:value="editing.temperature" :min="0" :max="2" :step="0.1" :disabled="!editing.sendTemperature" style="flex: 1" />
            <NInputNumber v-model:value="editing.temperature" :min="0" :max="2" :step="0.1" size="small" style="width: 90px" :disabled="!editing.sendTemperature" />
          </div>
        </NFormItem>
        <NFormItem label="Top P">
          <div class="param">
            <NSwitch v-model:value="editing.sendTopP" size="small" />
            <NSlider v-model:value="editing.topP" :min="0" :max="1" :step="0.05" :disabled="!editing.sendTopP" style="flex: 1" />
            <NInputNumber v-model:value="editing.topP" :min="0" :max="1" :step="0.05" size="small" style="width: 90px" :disabled="!editing.sendTopP" />
          </div>
        </NFormItem>
        <NFormItem label="Max Tokens">
          <div class="param">
            <NSelect
              v-model:value="editing.tokenParam"
              size="small"
              style="width: 200px"
              :options="[
                { label: 'max_tokens', value: 'max_tokens' },
                { label: 'max_completion_tokens', value: 'max_completion_tokens' },
                { label: '不发送', value: 'none' },
              ]"
            />
            <NInputNumber v-model:value="editing.maxTokens" :min="256" :max="200000" :step="1000" size="small" style="flex: 1" :disabled="editing.tokenParam === 'none'" />
          </div>
        </NFormItem>
        <NFormItem label="流式输出">
          <NSwitch v-model:value="editing.stream" />
        </NFormItem>
        <NFormItem label="超时（秒）">
          <NInputNumber v-model:value="editing.timeout" :min="0" :max="3600" size="small" style="width: 160px" />
          <span class="muted small" style="margin-left: 8px">流式输出时为无数据超时，0 表示不限制</span>
        </NFormItem>
        <NFormItem label="额外请求头">
          <NInput v-model:value="editing.extraHeaders" type="textarea" :rows="2" placeholder='可选，JSON 格式，如 {"HTTP-Referer":"https://example.com"}' />
        </NFormItem>
      </NForm>

      <div v-if="testResult" class="test-result" :class="testResult.ok ? 'ok-box' : 'bad-box'">
        <div>
          <b>{{ testResult.ok ? '连接成功' : '连接失败' }}</b>
          <span class="muted small">　{{ testResult.latency }}ms · {{ testResult.endpoint }}</span>
        </div>
        <div v-if="testResult.ok">模型返回：{{ testResult.content }}</div>
        <template v-else>
          <div>{{ testResult.error }}</div>
          <div v-if="errorHint(testResult.kind)" class="small muted">{{ errorHint(testResult.kind) }}</div>
        </template>
      </div>

      <template #footer>
        <div class="footer">
          <NButton :loading="testing && testingId === editing.id" @click="runTest(editing)">
            <template #icon><Zap :size="15" /></template>
            测试连接
          </NButton>
          <div class="grow" />
          <NButton @click="editorOpen = false">取消</NButton>
          <NButton type="primary" @click="save">保存</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.tip {
  margin-bottom: 14px;
}
.head {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
}
.item.def {
  border: 1px solid var(--primary);
}
.item-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.mono {
  font-family: Consolas, monospace;
  word-break: break-all;
}
.ops {
  margin-top: 8px;
}
.ok {
  color: var(--mut-lu);
}
.bad {
  color: var(--mut-ji);
}
.notes {
  margin-top: 16px;
}
.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-bottom: 14px;
}
.col {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.param {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.test-result {
  border-radius: 8px;
  padding: 10px 12px;
  margin-top: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ok-box {
  border: 1px solid var(--mut-lu);
}
.bad-box {
  border: 1px solid var(--mut-ji);
}
.footer {
  display: flex;
  gap: 8px;
}
@media (max-width: 520px) {
  .list {
    grid-template-columns: 1fr;
  }
}
</style>
