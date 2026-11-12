export type StageKey = 'basic' | 'life' | 'decade' | 'annual' | 'summary' | 'custom' | 'full'
export type SectionStatus = 'pending' | 'running' | 'done' | 'failed'
export type AnalysisMode = 'staged' | 'single'

export interface SectionDef {
  id: string
  stage: StageKey
  title: string
  /** 报告目录分组 */
  group: string
  /** 大限分析：起止大限序号（0 起，包含） */
  decadeFrom?: number
  decadeTo?: number
  /** 流年分析：大限序号与年份区间 */
  decadeOrder?: number
  yearFrom?: number
  yearTo?: number
}

export interface SectionResult extends SectionDef {
  status: SectionStatus
  content: string
  error: string
  /** 错误类型，用于给出处理建议 */
  errorKind?: string
  truncated: boolean
  model: string
  startedAt: number
  finishedAt: number
}

export interface ReportRecord {
  id: string
  chartId: string
  mode: AnalysisMode
  templateId: string
  templateName: string
  apiName: string
  model: string
  sections: SectionResult[]
  fullContent: string
  createdAt: number
  updatedAt: number
  completedAt: number
}

export type TaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed'

export interface TaskRecord {
  id: string
  chartId: string
  reportId: string
  status: TaskStatus
  currentStage: string
  completedStages: string[]
  totalStages: number
  updatedAt: number
}

export interface PromptTemplate {
  id: string
  name: string
  builtin: boolean
  /** 系统角色 */
  system: string
  /** 完整分析提示词（Markdown，含 {{CHART_DATA}}） */
  content: string
  /** 分阶段指令 */
  stages: {
    basic: string
    life: string
    decade: string
    annual: string
    summary: string
    custom: string
  }
  /** 自定义分析项目 */
  customItems: string
  updatedAt: number
}
