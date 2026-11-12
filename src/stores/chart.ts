import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { BirthInput, ChartRecord } from '@/types/chart'
import { generateAstrolabe } from '@/services/iztro'
import { adaptChart } from '@/services/chartAdapter'
import * as db from '@/database/indexedDB'
import { uid } from '@/utils/common'

export function emptyBirthInput(): BirthInput {
  return {
    name: '',
    // 性别必须明确选择，默认不预选
    gender: '' as unknown as BirthInput['gender'],
    calendar: 'solar',
    solarDate: '',
    lunarYear: 1990,
    lunarMonth: 1,
    lunarDay: 1,
    isLeapMonth: false,
    birthTime: '12:00',
    unknownTime: false,
    location: '',
    longitude: null,
    timezone: 8,
    useTrueSolarTime: false,
    daylightSaving: false,
  }
}

/** 示例命盘（PRD 示例：1993-02-26 22:20 男） */
export function exampleBirthInput(): BirthInput {
  return {
    ...emptyBirthInput(),
    name: '示例用户',
    gender: '男',
    solarDate: '1993-02-26',
    birthTime: '22:20',
    location: '北京',
    longitude: 116.41,
    useTrueSolarTime: true,
  }
}

/** 根据出生信息计算命盘（不保存） */
export function computeChart(input: BirthInput): ChartRecord {
  const result = generateAstrolabe(input)
  const chartData = adaptChart(input, result)
  const now = Date.now()
  return { id: uid('chart_'), basicInfo: { ...input }, chartData, createdAt: now, updatedAt: now }
}

export const useChartStore = defineStore('chart', () => {
  const current = ref<ChartRecord | null>(null)
  const recent = ref<ChartRecord[]>([])
  /** 首页表单草稿（编辑重排时预填） */
  const draft = ref<BirthInput | null>(null)
  const editingId = ref<string>('')

  async function create(input: BirthInput): Promise<ChartRecord> {
    const rec = computeChart(input)
    if (editingId.value) {
      // 修改出生信息并重新排盘：沿用原记录 id，清除旧报告
      const old = await db.getChart(editingId.value)
      if (old) {
        rec.id = old.id
        rec.createdAt = old.createdAt
        const report = await db.getReportByChart(old.id)
        if (report) await db.deleteReport(report.id)
      }
      editingId.value = ''
    }
    await db.saveChart(rec)
    current.value = rec
    return rec
  }

  async function load(id: string): Promise<ChartRecord | null> {
    if (current.value?.id === id) return current.value
    const rec = await db.getChart(id)
    current.value = rec ?? null
    return current.value
  }

  async function loadRecent(limit = 5) {
    try {
      recent.value = (await db.listCharts()).slice(0, limit)
    } catch {
      recent.value = []
    }
  }

  async function remove(id: string) {
    await db.deleteChart(id)
    if (current.value?.id === id) current.value = null
    recent.value = recent.value.filter((r) => r.id !== id)
  }

  function startEdit(rec: ChartRecord) {
    draft.value = { ...rec.basicInfo }
    editingId.value = rec.id
  }

  function cancelEdit() {
    draft.value = null
    editingId.value = ''
  }

  return { current, recent, draft, editingId, create, load, loadRecent, remove, startEdit, cancelEdit }
})
