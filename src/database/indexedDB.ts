import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ChartRecord } from '@/types/chart'
import type { ReportRecord, TaskRecord } from '@/types/report'
import { toPlain } from '@/utils/common'

interface ZiWeiDBSchema extends DBSchema {
  charts: {
    key: string
    value: ChartRecord
    indexes: { createdAt: number }
  }
  reports: {
    key: string
    value: ReportRecord
    indexes: { chartId: string; createdAt: number }
  }
  tasks: {
    key: string
    value: TaskRecord
    indexes: { chartId: string }
  }
}

const DB_NAME = 'ZiWeiDB'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<ZiWeiDBSchema>> | null = null

export function getDB(): Promise<IDBPDatabase<ZiWeiDBSchema>> {
  if (!dbPromise) {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('当前浏览器不支持 IndexedDB，无法保存历史记录。'))
    }
    dbPromise = openDB<ZiWeiDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('charts')) {
          const s = db.createObjectStore('charts', { keyPath: 'id' })
          s.createIndex('createdAt', 'createdAt')
        }
        if (!db.objectStoreNames.contains('reports')) {
          const s = db.createObjectStore('reports', { keyPath: 'id' })
          s.createIndex('chartId', 'chartId')
          s.createIndex('createdAt', 'createdAt')
        }
        if (!db.objectStoreNames.contains('tasks')) {
          const s = db.createObjectStore('tasks', { keyPath: 'id' })
          s.createIndex('chartId', 'chartId')
        }
      },
    })
  }
  return dbPromise
}

/* ---------- charts ---------- */
export async function saveChart(rec: ChartRecord): Promise<void> {
  const db = await getDB()
  await db.put('charts', toPlain(rec))
}

export async function getChart(id: string): Promise<ChartRecord | undefined> {
  const db = await getDB()
  return db.get('charts', id)
}

export async function listCharts(): Promise<ChartRecord[]> {
  const db = await getDB()
  const all = await db.getAll('charts')
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

/** 删除命盘及其报告、任务 */
export async function deleteChart(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['charts', 'reports', 'tasks'], 'readwrite')
  await tx.objectStore('charts').delete(id)
  const reports = await tx.objectStore('reports').index('chartId').getAllKeys(id)
  for (const k of reports) await tx.objectStore('reports').delete(k)
  const tasks = await tx.objectStore('tasks').index('chartId').getAllKeys(id)
  for (const k of tasks) await tx.objectStore('tasks').delete(k)
  await tx.done
}

/* ---------- reports ---------- */
export async function saveReport(rec: ReportRecord): Promise<void> {
  const db = await getDB()
  await db.put('reports', toPlain(rec))
}

export async function getReport(id: string): Promise<ReportRecord | undefined> {
  const db = await getDB()
  return db.get('reports', id)
}

export async function getReportByChart(chartId: string): Promise<ReportRecord | undefined> {
  const db = await getDB()
  const list = await db.getAllFromIndex('reports', 'chartId', chartId)
  return list.sort((a, b) => b.updatedAt - a.updatedAt)[0]
}

export async function listReports(): Promise<ReportRecord[]> {
  const db = await getDB()
  return db.getAll('reports')
}

export async function deleteReport(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['reports', 'tasks'], 'readwrite')
  await tx.objectStore('reports').delete(id)
  const tasks = await tx.objectStore('tasks').getAll()
  for (const t of tasks) if (t.reportId === id) await tx.objectStore('tasks').delete(t.id)
  await tx.done
}

/* ---------- tasks ---------- */
export async function saveTask(rec: TaskRecord): Promise<void> {
  const db = await getDB()
  await db.put('tasks', toPlain(rec))
}

export async function getTaskByChart(chartId: string): Promise<TaskRecord | undefined> {
  const db = await getDB()
  const list = await db.getAllFromIndex('tasks', 'chartId', chartId)
  return list.sort((a, b) => b.updatedAt - a.updatedAt)[0]
}

export async function listTasks(): Promise<TaskRecord[]> {
  const db = await getDB()
  return db.getAll('tasks')
}

/* ---------- 导入导出 ---------- */
export interface BackupData {
  app: 'ziwei-ai'
  version: number
  exportedAt: number
  charts: ChartRecord[]
  reports: ReportRecord[]
  tasks: TaskRecord[]
}

export async function exportAll(): Promise<BackupData> {
  const db = await getDB()
  return {
    app: 'ziwei-ai',
    version: 1,
    exportedAt: Date.now(),
    charts: await db.getAll('charts'),
    reports: await db.getAll('reports'),
    tasks: await db.getAll('tasks'),
  }
}

export async function importAll(data: BackupData): Promise<{ charts: number; reports: number }> {
  if (!data || data.app !== 'ziwei-ai' || !Array.isArray(data.charts)) {
    throw new Error('文件格式不正确，不是本站导出的历史记录。')
  }
  const db = await getDB()
  const tx = db.transaction(['charts', 'reports', 'tasks'], 'readwrite')
  for (const c of data.charts) await tx.objectStore('charts').put(c)
  for (const r of data.reports || []) await tx.objectStore('reports').put(r)
  for (const t of data.tasks || []) await tx.objectStore('tasks').put(t)
  await tx.done
  return { charts: data.charts.length, reports: (data.reports || []).length }
}

export async function clearAll(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['charts', 'reports', 'tasks'], 'readwrite')
  await tx.objectStore('charts').clear()
  await tx.objectStore('reports').clear()
  await tx.objectStore('tasks').clear()
  await tx.done
}
