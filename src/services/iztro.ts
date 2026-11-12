import { astro } from 'iztro'
import { lunar2solar } from 'lunar-lite'
import { getLeapMonth } from 'lunar-lite/lib/leap'
import type { BirthInput, TimeResolution } from '@/types/chart'
import { isValidSolarDate, isValidTime, resolveBirthTime } from '@/utils/solarTime'

export type IztroAstrolabe = ReturnType<typeof astro.bySolar>

export class ChartInputError extends Error {}

const pad = (n: number) => String(n).padStart(2, '0')

/** 将输入的出生日期统一换算为公历 YYYY-MM-DD */
export function toSolarDate(input: BirthInput): string {
  if (input.calendar === 'solar') {
    if (!isValidSolarDate(input.solarDate)) throw new ChartInputError('出生日期格式错误或日期不存在，请重新输入。')
    const [y, m, d] = input.solarDate.split('-').map(Number)
    return `${y}-${pad(m)}-${pad(d)}`
  }
  const { lunarYear: y, lunarMonth: m, lunarDay: d } = input
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 30) {
    throw new ChartInputError('农历日期格式错误，请重新输入。')
  }
  if (input.isLeapMonth && getLeapMonth(y) !== m) {
    throw new ChartInputError(`农历 ${y} 年没有闰${m}月，请取消“闰月”或重新选择月份。`)
  }
  try {
    const s = lunar2solar(`${y}-${m}-${d}`, input.isLeapMonth)
    return `${s.solarYear}-${pad(s.solarMonth)}-${pad(s.solarDay)}`
  } catch (e) {
    throw new ChartInputError(`农历日期不存在：${(e as Error).message}`)
  }
}

/** 校验出生信息，返回错误列表 */
export function validateBirthInput(input: BirthInput): string[] {
  const errors: string[] = []
  if (!input.name || !input.name.trim()) errors.push('请填写姓名。')
  if (input.gender !== '男' && input.gender !== '女') errors.push('请明确选择性别。')
  if (!input.unknownTime && !isValidTime(input.birthTime)) errors.push('请填写正确的出生时间（00:00～23:59）。')
  try {
    const solar = toSolarDate(input)
    const [y] = solar.split('-').map(Number)
    if (y < 1900 || y > 2100) errors.push('出生年份需在 1900～2100 年之间。')
    const birth = new Date(`${solar}T00:00:00`)
    if (birth.getTime() > Date.now() + 86400000) errors.push('出生日期不能晚于今天。')
  } catch (e) {
    errors.push((e as Error).message)
  }
  if (input.longitude !== null && input.longitude !== undefined) {
    if (Number.isNaN(input.longitude) || input.longitude < -180 || input.longitude > 180) {
      errors.push('地理经度需在 -180～180 之间（东经为正，西经为负）。')
    }
  }
  if (input.useTrueSolarTime && !input.unknownTime && (input.longitude === null || input.longitude === undefined)) {
    errors.push('启用真太阳时需要提供出生地点或地理经度。')
  }
  if (input.timezone < -12 || input.timezone > 14) errors.push('时区设置不正确。')
  return errors
}

export interface IztroResult {
  astrolabe: IztroAstrolabe
  time: TimeResolution
  solarDate: string
}

/** 调用 iztro 生成原始命盘对象 */
export function generateAstrolabe(input: BirthInput): IztroResult {
  const errors = validateBirthInput(input)
  if (errors.length) throw new ChartInputError(errors.join('\n'))
  const solarDate = toSolarDate(input)
  const time = resolveBirthTime({
    solarDate,
    time: input.unknownTime ? '12:00' : input.birthTime,
    useTrueSolarTime: input.useTrueSolarTime,
    longitude: input.longitude,
    timezone: input.timezone,
    daylightSaving: input.daylightSaving,
    unknownTime: input.unknownTime,
  })
  try {
    const [y, m, d] = time.effectiveDate.split('-').map(Number)
    const astrolabe = astro.withOptions({
      type: 'solar',
      dateStr: `${y}-${m}-${d}`,
      timeIndex: time.timeIndex,
      gender: input.gender,
      fixLeap: true,
      language: 'zh-CN',
    }) as IztroAstrolabe
    return { astrolabe, time, solarDate }
  } catch (e) {
    throw new Error(`iztro 排盘失败：${(e as Error).message || String(e)}`)
  }
}
