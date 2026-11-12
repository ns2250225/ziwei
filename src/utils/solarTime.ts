import type { TimeResolution } from '@/types/chart'

const pad = (n: number) => String(n).padStart(2, '0')

/** 校验公历日期是否真实存在 */
export function isValidSolarDate(dateStr: string): boolean {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateStr)
  if (!m) return false
  const y = +m[1]
  const mo = +m[2]
  const d = +m[3]
  if (mo < 1 || mo > 12 || d < 1) return false
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

export function isValidTime(t: string): boolean {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(t)
  if (!m) return false
  return +m[1] >= 0 && +m[1] <= 23 && +m[2] >= 0 && +m[2] <= 59
}

/** 一年中的第几天（1 起） */
function dayOfYear(y: number, m: number, d: number): number {
  const start = Date.UTC(y, 0, 1)
  return Math.floor((Date.UTC(y, m - 1, d) - start) / 86400000) + 1
}

/**
 * 均时差（分钟）。真太阳时 = 平太阳时 + 均时差
 * 采用常用近似公式，误差约 ±1 分钟。
 */
export function equationOfTime(y: number, m: number, d: number): number {
  const n = dayOfYear(y, m, d)
  const b = (2 * Math.PI * (n - 81)) / 364
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
}

/** 时辰序号：0 早子(00-01) 1 丑 ... 11 亥 12 晚子(23-24) */
export function timeToIndex(hour: number): number {
  if (hour === 0) return 0
  if (hour === 23) return 12
  return Math.floor((hour + 1) / 2)
}

export const TIME_INDEX_LABELS = [
  '早子时 00:00~01:00',
  '丑时 01:00~03:00',
  '寅时 03:00~05:00',
  '卯时 05:00~07:00',
  '辰时 07:00~09:00',
  '巳时 09:00~11:00',
  '午时 11:00~13:00',
  '未时 13:00~15:00',
  '申时 15:00~17:00',
  '酉时 17:00~19:00',
  '戌时 19:00~21:00',
  '亥时 21:00~23:00',
  '晚子时 23:00~24:00',
]

/**
 * 处理出生时间：夏令时、真太阳时（经度修正 + 均时差）、跨日
 * 注意：经度用于计算地方平太阳时，时区仅用于确定标准子午线（时区 × 15°），两者不可混用。
 */
export function resolveBirthTime(opts: {
  solarDate: string
  time: string
  useTrueSolarTime: boolean
  longitude: number | null
  timezone: number
  daylightSaving: boolean
  unknownTime: boolean
}): TimeResolution {
  const [y, m, d] = opts.solarDate.split('-').map(Number)
  const [hh, mm] = opts.time.split(':').map(Number)
  const notes: string[] = []
  let dstOffset = 0
  let lngOffset = 0
  let eot = 0
  let applied = false

  // 以 UTC 毫秒做纯日期运算，避免受浏览器本地时区影响
  let ms = Date.UTC(y, m - 1, d, hh, mm)

  if (opts.unknownTime) {
    notes.push('未知出生时辰：按午时（11:00~13:00）排盘，时辰相关的命宫、身宫、星曜位置可能不准确。')
  } else {
    if (opts.daylightSaving) {
      dstOffset = -60
      ms += dstOffset * 60000
      notes.push('已扣除夏令时 1 小时。')
    }
    if (opts.useTrueSolarTime) {
      if (opts.longitude === null || Number.isNaN(opts.longitude)) {
        notes.push('已开启真太阳时但未提供经度，按钟表时间排盘。')
      } else {
        const meridian = opts.timezone * 15
        lngOffset = (opts.longitude - meridian) * 4
        eot = equationOfTime(y, m, d)
        ms += Math.round((lngOffset + eot) * 60000)
        applied = true
        notes.push(
          `真太阳时 = 钟表时间${dstOffset ? '（扣除夏令时）' : ''} + 经度修正 ${lngOffset.toFixed(1)} 分钟（东经 ${opts.longitude}° 相对标准子午线 ${meridian}°）+ 均时差 ${eot.toFixed(1)} 分钟。`,
        )
      }
    }
  }

  const dt = new Date(ms)
  const effectiveDate = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
  const effectiveTime = `${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}`
  const clockDate = `${y}-${pad(m)}-${pad(d)}`
  const dateShifted = effectiveDate !== clockDate
  if (dateShifted) {
    notes.push(`时间换算后跨日：排盘日期由 ${clockDate} 调整为 ${effectiveDate}。`)
  }
  const timeIndex = opts.unknownTime ? 6 : timeToIndex(dt.getUTCHours())

  return {
    clockDate,
    clockTime: `${pad(hh)}:${pad(mm)}`,
    effectiveDate,
    effectiveTime,
    trueSolarApplied: applied,
    longitudeOffsetMinutes: lngOffset,
    equationOfTimeMinutes: eot,
    dstOffsetMinutes: dstOffset,
    dateShifted,
    timeIndex,
    notes,
  }
}
