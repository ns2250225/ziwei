import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { ApiConfig } from '@/types/ai'
import type { AnalysisMode, PromptTemplate } from '@/types/report'
import { createDefaultTemplate, DEFAULT_TEMPLATE_ID } from '@/prompts/default'
import { uid } from '@/utils/common'

export type ThemeMode = 'light' | 'dark' | 'auto'
export type ReadingWidth = 'narrow' | 'medium' | 'wide' | 'full'
export type ChartTheme = 'classic' | 'ink' | 'cinnabar' | 'azure'

export interface Appearance {
  theme: ThemeMode
  fontSize: number
  readingWidth: ReadingWidth
  chartTheme: ChartTheme
}

interface GeneralSettings {
  defaultApiId: string
  defaultTemplateId: string
  analysisMode: AnalysisMode
  appearance: Appearance
  privacyAcknowledged: boolean
}

const K_CONFIGS = 'ziwei.apiConfigs'
const K_KEYS = 'ziwei.apiKeys'
const K_SETTINGS = 'ziwei.settings'
const K_TEMPLATES = 'ziwei.templates'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 存储不可用时忽略 */
  }
}

export function createApiConfig(partial: Partial<ApiConfig> = {}): ApiConfig {
  return {
    id: uid('api_'),
    name: '我的模型',
    url: 'https://api.openai.com/v1',
    urlMode: 'base',
    apiKey: '',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 16000,
    topP: 1,
    stream: true,
    sendTemperature: true,
    sendTopP: true,
    tokenParam: 'max_tokens',
    timeout: 300,
    extraHeaders: '',
    ...partial,
  }
}

const DEFAULT_APPEARANCE: Appearance = { theme: 'auto', fontSize: 15, readingWidth: 'medium', chartTheme: 'classic' }

export const useSettingsStore = defineStore('settings', () => {
  // —— API 配置（API Key 与其他配置分开存储） ——
  const storedConfigs = load<Omit<ApiConfig, 'apiKey'>[]>(K_CONFIGS, [])
  const storedKeys = load<Record<string, string>>(K_KEYS, {})
  const apiConfigs = ref<ApiConfig[]>(
    storedConfigs.map((c) => createApiConfig({ ...c, apiKey: storedKeys[c.id] ?? '' })),
  )

  const general = ref<GeneralSettings>({
    defaultApiId: '',
    defaultTemplateId: DEFAULT_TEMPLATE_ID,
    analysisMode: 'staged',
    privacyAcknowledged: false,
    ...load<Partial<GeneralSettings>>(K_SETTINGS, {}),
    appearance: { ...DEFAULT_APPEARANCE, ...(load<Partial<GeneralSettings>>(K_SETTINGS, {}).appearance ?? {}) },
  })

  // —— 提示词模板 ——
  const storedTemplates = load<PromptTemplate[]>(K_TEMPLATES, [])
  const builtin = createDefaultTemplate()
  const templates = ref<PromptTemplate[]>(
    storedTemplates.length
      ? storedTemplates.map((t) => ({ ...builtin, ...t, stages: { ...builtin.stages, ...(t.stages ?? {}) } }))
      : [builtin],
  )
  if (!templates.value.some((t) => t.id === DEFAULT_TEMPLATE_ID)) templates.value.unshift(builtin)

  watch(
    apiConfigs,
    (list) => {
      save(
        K_CONFIGS,
        list.map(({ apiKey: _k, ...rest }) => rest),
      )
      const keys: Record<string, string> = {}
      for (const c of list) if (c.apiKey) keys[c.id] = c.apiKey
      save(K_KEYS, keys)
    },
    { deep: true },
  )
  watch(general, (v) => save(K_SETTINGS, v), { deep: true })
  watch(templates, (v) => save(K_TEMPLATES, v), { deep: true })

  const defaultApi = computed<ApiConfig | undefined>(
    () => apiConfigs.value.find((c) => c.id === general.value.defaultApiId) ?? apiConfigs.value[0],
  )
  const apiReady = computed(() => !!(defaultApi.value && defaultApi.value.url && defaultApi.value.model))

  const defaultTemplate = computed<PromptTemplate>(
    () => templates.value.find((t) => t.id === general.value.defaultTemplateId) ?? templates.value[0],
  )

  function getApi(id?: string) {
    return apiConfigs.value.find((c) => c.id === id) ?? defaultApi.value
  }
  function getTemplate(id?: string) {
    return templates.value.find((t) => t.id === id) ?? defaultTemplate.value
  }

  function upsertApi(cfg: ApiConfig) {
    const i = apiConfigs.value.findIndex((c) => c.id === cfg.id)
    if (i >= 0) apiConfigs.value[i] = { ...cfg }
    else apiConfigs.value.push({ ...cfg })
    if (!general.value.defaultApiId) general.value.defaultApiId = cfg.id
  }
  function removeApi(id: string) {
    apiConfigs.value = apiConfigs.value.filter((c) => c.id !== id)
    if (general.value.defaultApiId === id) general.value.defaultApiId = apiConfigs.value[0]?.id ?? ''
  }
  function setDefaultApi(id: string) {
    general.value.defaultApiId = id
  }
  /** 一键清除所有 API 配置（含密钥） */
  function clearAllApi() {
    apiConfigs.value = []
    general.value.defaultApiId = ''
    try {
      localStorage.removeItem(K_KEYS)
      localStorage.removeItem(K_CONFIGS)
    } catch {
      /* ignore */
    }
  }

  function upsertTemplate(t: PromptTemplate) {
    const i = templates.value.findIndex((x) => x.id === t.id)
    const v = { ...t, updatedAt: Date.now() }
    if (i >= 0) templates.value[i] = v
    else templates.value.push(v)
  }
  function removeTemplate(id: string) {
    if (id === DEFAULT_TEMPLATE_ID) return
    templates.value = templates.value.filter((t) => t.id !== id)
    if (general.value.defaultTemplateId === id) general.value.defaultTemplateId = DEFAULT_TEMPLATE_ID
  }
  function resetBuiltinTemplate() {
    const i = templates.value.findIndex((t) => t.id === DEFAULT_TEMPLATE_ID)
    const fresh = createDefaultTemplate()
    if (i >= 0) templates.value[i] = fresh
    else templates.value.unshift(fresh)
    return fresh
  }

  return {
    apiConfigs,
    general,
    templates,
    defaultApi,
    apiReady,
    defaultTemplate,
    getApi,
    getTemplate,
    upsertApi,
    removeApi,
    setDefaultApi,
    clearAllApi,
    upsertTemplate,
    removeTemplate,
    resetBuiltinTemplate,
  }
})
