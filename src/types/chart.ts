/** 出生信息（用户输入） */
export type Gender = '男' | '女'
export type CalendarType = 'solar' | 'lunar'

export interface BirthInput {
  name: string
  gender: Gender
  /** 历法：公历 / 农历 */
  calendar: CalendarType
  /** 公历日期 YYYY-MM-DD（calendar=solar 时使用） */
  solarDate: string
  /** 农历日期（calendar=lunar 时使用） */
  lunarYear: number
  lunarMonth: number
  lunarDay: number
  isLeapMonth: boolean
  /** 钟表时间 HH:mm */
  birthTime: string
  /** 是否未知出生时辰 */
  unknownTime: boolean
  /** 出生地点名称（仅展示用） */
  location: string
  /** 地理经度（东经为正），与时区无关 */
  longitude: number | null
  /** 时区（UTC 偏移小时），用于计算标准子午线，默认 +8 */
  timezone: number
  /** 是否启用真太阳时 */
  useTrueSolarTime: boolean
  /** 出生时是否处于夏令时（钟表时间比标准时间快 1 小时） */
  daylightSaving: boolean
}

export interface TimeResolution {
  /** 原始钟表日期 YYYY-MM-DD（公历） */
  clockDate: string
  /** 原始钟表时间 HH:mm */
  clockTime: string
  /** 换算后用于排盘的日期 YYYY-MM-DD */
  effectiveDate: string
  /** 换算后用于排盘的时间 HH:mm */
  effectiveTime: string
  /** 是否使用了真太阳时 */
  trueSolarApplied: boolean
  /** 经度修正分钟 */
  longitudeOffsetMinutes: number
  /** 均时差分钟 */
  equationOfTimeMinutes: number
  /** 夏令时修正分钟 */
  dstOffsetMinutes: number
  /** 是否跨日 */
  dateShifted: boolean
  /** iztro 时辰序号 0~12 */
  timeIndex: number
  notes: string[]
}

export interface StarInfo {
  name: string
  /** 星曜类型：major / soft / tough / adjective / flower / helper / lucun / tianma 等 */
  type: string
  scope: string
  brightness: string
  /** 生年四化：禄 / 权 / 科 / 忌 */
  mutagen: string
}

export interface MutagenRef {
  /** 禄权科忌 */
  mutagen: string
  star: string
  /** 星曜所在宫位索引（0=寅），未找到为 -1 */
  palaceIndex: number
  palaceName: string
  palaceBranch: string
}

export interface PalaceData {
  /** iztro 宫位索引，0 = 寅宫 */
  index: number
  /** 标准化宫名（如 命宫、交友宫） */
  name: string
  /** iztro 原始宫名 */
  rawName: string
  stem: string
  branch: string
  isBodyPalace: boolean
  isOriginalPalace: boolean
  majorStars: StarInfo[]
  minorStars: StarInfo[]
  adjectiveStars: StarInfo[]
  /** 本宫中具有生年四化的星曜 */
  birthMutagens: { star: string; mutagen: string }[]
  /** 自化：本宫宫干四化落在本宫星曜上 */
  selfMutagens: { star: string; mutagen: string }[]
  /** 宫干飞化：本宫宫干四化飞入的宫位 */
  flyingMutagens: MutagenRef[]
  changsheng12: string
  boshi12: string
  jiangqian12: string
  suiqian12: string
  decadal: { startAge: number; endAge: number; stem: string; branch: string }
  /** 小限年龄（虚岁） */
  minorLimitAges: number[]
  /** 流年年龄（虚岁，流年太岁落入本宫的年龄） */
  annualAges: number[]
  /** 三方四正 */
  surrounded: { opposite: number; wealth: number; career: number }
}

export interface AnnualData {
  year: number
  /** 虚岁 */
  age: number
  stem: string
  branch: string
  /** 流年命宫所在宫位索引 */
  lifePalaceIndex: number
  lifePalaceBranch: string
  /** 流年命宫对应的原局宫名 */
  lifePalaceOriginalName: string
  mutagens: MutagenRef[]
  /** 流年十二宫名，下标为宫位索引 */
  palaceNames: string[]
  /** 流年星曜（流昌、流曲等），下标为宫位索引 */
  stars: string[][]
  /** 所属大限序号（0 起） */
  decadeOrder: number
  /** 当年小限所在宫 */
  minorLimitPalaceName: string
  minorLimitBranch: string
}

export interface DecadeData {
  /** 大限序号（0 起，按年龄排序） */
  order: number
  palaceIndex: number
  /** 大限命宫对应原局宫名 */
  palaceName: string
  stem: string
  branch: string
  startAge: number
  endAge: number
  startYear: number
  endYear: number
  mutagens: MutagenRef[]
  palaceNames: string[]
  stars: string[][]
  years: AnnualData[]
}

export interface ChartBasicInfo {
  name: string
  gender: Gender
  /** 阴男 / 阳男 / 阴女 / 阳女 */
  yinYangGender: string
  calendar: CalendarType
  solarDate: string
  clockTime: string
  trueSolarTime: string | null
  /** 实际排盘使用的公历日期（真太阳时可能跨日） */
  effectiveSolarDate: string
  lunarDate: string
  /** 时辰名，如 亥时 */
  timeBranch: string
  timeRange: string
  timeIndex: number
  unknownTime: boolean
  /** 节气四柱 */
  jieqiPillars: string
  /** 非节气四柱（以农历月划分） */
  lunarPillars: string
  fiveElements: string
  lifeMaster: string
  bodyMaster: string
  /** 子年斗君地支 */
  ziDouJun: string
  ziDouJunPalace: string
  bodyPalace: string
  bodyPalaceBranch: string
  lifePalaceBranch: string
  zodiac: string
  sign: string
  location: string
  longitude: number | null
  timezone: number
  birthYearStem: string
  birthYearMutagens: MutagenRef[]
  timeNotes: string[]
}

export interface ChartData {
  version: number
  engine: string
  basicInfo: ChartBasicInfo
  palaces: PalaceData[]
  decades: DecadeData[]
  /** 所有大限对应的流年（按年份排序） */
  annualFortunes: AnnualData[]
}

export interface ChartRecord {
  id: string
  basicInfo: BirthInput
  chartData: ChartData
  createdAt: number
  updatedAt: number
}

/** 命盘宫位叠加显示（大限、流年、飞化） */
export interface PalaceOverlay {
  decadalName?: string
  decadalStars?: string[]
  decadalMutagens?: { star: string; mutagen: string }[]
  yearlyName?: string
  yearlyStars?: string[]
  yearlyMutagens?: { star: string; mutagen: string }[]
  /** 选中宫位的宫干四化飞入本宫 */
  flyIn?: { star: string; mutagen: string }[]
  isDecadalLife?: boolean
  isYearlyLife?: boolean
}
