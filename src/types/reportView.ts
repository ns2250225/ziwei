import type { SectionResult } from './report'
import type { TocItem } from '@/utils/markdown'

export interface RenderedSection {
  section: SectionResult
  html: string
  toc: TocItem[]
  failed: boolean
}
