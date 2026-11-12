import { util } from 'iztro'
import { getHeavenlyStemAndEarthlyBranchBySolarDate } from 'lunar-lite'
import type {
  AnnualData,
  BirthInput,
  ChartData,
  DecadeData,
  MutagenRef,
  PalaceData,
  StarInfo,
} from '@/types/chart'
import type { IztroResult } from './iztro'

export const MUTAGEN_LABELS = ['禄', '权', '科', '忌'] as const
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
export const PALACE_ORDER = ['命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫', '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫']

/** 地支在 4×4 网格中的位置（传统命盘布局） */
export const GRID_POS: Record<string, [number, number]> = {
  巳: [1, 1], 午: [1, 2], 未: [1, 3], 申: [1, 4],
  辰: [2, 1], 酉: [2, 4],
  卯: [3, 1], 戌: [3, 4],
  寅: [4, 1], 丑: [4, 2], 子: [4, 3], 亥: [4, 4],
}

/** 宫位索引（0=寅）转地支 */
export const indexToBranch = (i: number) => BRANCHES[(i + 2) % 12]
/** 地支转宫位索引（0=寅） */
export const branchToIndex = (b: string) => (BRANCHES.indexOf(b) - 2 + 12) % 12

/** 宫名标准化：仆役 → 交友宫，其余补全“宫”字 */
export function normalizePalaceName(name: string): string {
  if (!name) return ''
  if (name === '仆役' || name === '交友' || name === '仆役宫') return '交友宫'
  return name.endsWith('宫') ? name : `${name}宫`
}

/** 简称（命、兄、夫…） */
export function shortPalaceName(name: string): string {
  const n = normalizePalaceName(name)
  return n.replace('宫', '').slice(0, 1)
}

type RawStar = { name: string; type: string; scope: string; brightness?: string; mutagen?: string }

function toStarInfo(s: RawStar): StarInfo {
  return {
    name: s.name,
    type: s.type,
    scope: s.scope,
    brightness: s.brightness || '',
    mutagen: s.mutagen || '',
  }
}

/**
 * 将 iztro 原始命盘转换为统一的命盘 JSON 数据结构
 */
export function adaptChart(input: BirthInput, result: IztroResult): ChartData {
  const { astrolabe: a, time } = result
  const rawPalaces = a.palaces

  // —— 十二宫基础信息 ——
  const palaces: PalaceData[] = rawPalaces.map((p) => {
    const majorStars = p.majorStars.map((s) => toStarInfo(s as unknown as RawStar))
    const minorStars = p.minorStars.map((s) => toStarInfo(s as unknown as RawStar))
    const adjectiveStars = p.adjectiveStars.map((s) => toStarInfo(s as unknown as RawStar))
    return {
      index: p.index,
      name: normalizePalaceName(p.name),
      rawName: p.name,
      stem: p.heavenlyStem,
      branch: p.earthlyBranch,
      isBodyPalace: p.isBodyPalace,
      isOriginalPalace: p.isOriginalPalace,
      majorStars,
      minorStars,
      adjectiveStars,
      birthMutagens: [...majorStars, ...minorStars]
        .filter((s) => s.mutagen)
        .map((s) => ({ star: s.name, mutagen: s.mutagen })),
      selfMutagens: [],
      flyingMutagens: [],
      changsheng12: p.changsheng12,
      boshi12: p.boshi12,
      jiangqian12: p.jiangqian12,
      suiqian12: p.suiqian12,
      decadal: {
        startAge: p.decadal.range[0],
        endAge: p.decadal.range[1],
        stem: p.decadal.heavenlyStem,
        branch: p.decadal.earthlyBranch,
      },
      minorLimitAges: [...p.ages],
      annualAges: [],
      surrounded: {
        opposite: (p.index + 6) % 12,
        wealth: (p.index + 8) % 12,
        career: (p.index + 4) % 12,
      },
    }
  })

  /** 查找星曜所在宫位 */
  const findStar = (star: string): PalaceData | undefined =>
    palaces.find((p) =>
      [...p.majorStars, ...p.minorStars, ...p.adjectiveStars].some((s) => s.name === star),
    )

  const mutagenRefs = (stars: string[]): MutagenRef[] =>
    stars.map((star, i) => {
      const p = findStar(star)
      return {
        mutagen: MUTAGEN_LABELS[i] ?? '',
        star,
        palaceIndex: p ? p.index : -1,
        palaceName: p ? p.name : '',
        palaceBranch: p ? p.branch : '',
      }
    })

  // —— 自化 & 宫干飞化 ——
  for (const p of palaces) {
    const stars = util.getMutagensByHeavenlyStem(p.stem as never) as unknown as string[]
    const refs = mutagenRefs(stars)
    p.flyingMutagens = refs
    const own = new Set([...p.majorStars, ...p.minorStars].map((s) => s.name))
    p.selfMutagens = refs.filter((r) => own.has(r.star)).map((r) => ({ star: r.star, mutagen: r.mutagen }))
  }

  // —— 流年年龄（流年太岁所在宫） ——
  const yearBranch = a.rawDates.chineseDate.yearly[1] as string
  const yearBranchIdx = BRANCHES.indexOf(yearBranch)
  for (const p of palaces) {
    const target = BRANCHES.indexOf(p.branch)
    const ages: number[] = []
    for (let age = 1; age <= 120; age++) {
      if ((yearBranchIdx + age - 1) % 12 === target) ages.push(age)
    }
    p.annualAges = ages
  }

  const findMinorLimitPalace = (age: number) => palaces.find((p) => p.minorLimitAges.includes(age))

  // —— 大限与流年 ——
  const decadalList = a.decadalList()
  const decades: DecadeData[] = decadalList.map((d, order) => {
    const yearly = a.yearlyList(order)
    const years: AnnualData[] = yearly.map((y) => {
      const lifeIdx = y.palaceNames.indexOf('命宫' as never)
      const minor = findMinorLimitPalace(y.age)
      return {
        year: y.year,
        age: y.age,
        stem: y.heavenlyStem,
        branch: y.earthlyBranch,
        lifePalaceIndex: lifeIdx,
        lifePalaceBranch: lifeIdx >= 0 ? indexToBranch(lifeIdx) : '',
        lifePalaceOriginalName: lifeIdx >= 0 ? palaces[lifeIdx].name : '',
        mutagens: mutagenRefs(y.mutagen as unknown as string[]),
        palaceNames: (y.palaceNames as unknown as string[]).map(normalizePalaceName),
        stars: (y.stars ?? []).map((list) => list.map((s) => s.name as string)),
        decadeOrder: order,
        minorLimitPalaceName: minor ? minor.name : '',
        minorLimitBranch: minor ? minor.branch : '',
      }
    })
    return {
      order,
      palaceIndex: d.index,
      palaceName: palaces[d.index]?.name ?? normalizePalaceName(d.palaceName),
      stem: d.heavenlyStem,
      branch: d.earthlyBranch,
      startAge: d.ageRange[0],
      endAge: d.ageRange[1],
      startYear: d.yearRange[0],
      endYear: d.yearRange[1],
      mutagens: mutagenRefs(d.mutagen as unknown as string[]),
      palaceNames: (d.palaceNames as unknown as string[]).map(normalizePalaceName),
      stars: (d.stars ?? []).map((list) => list.map((s) => s.name as string)),
      years,
    }
  })
  const annualFortunes = decades.flatMap((d) => d.years).sort((x, y) => x.year - y.year)

  // —— 基本信息 ——
  const cd = a.rawDates.chineseDate
  const yearStem = cd.yearly[0] as string
  const yang = ['甲', '丙', '戊', '庚', '壬'].includes(yearStem)
  const jieqi = getHeavenlyStemAndEarthlyBranchBySolarDate(time.effectiveDate, time.timeIndex)
  const pillars = (c: { yearly: string[]; monthly: string[]; daily: string[]; hourly: string[] }) =>
    `${c.yearly.join('')} ${c.monthly.join('')} ${c.daily.join('')} ${c.hourly.join('')}`

  const lunarMonth = a.rawDates.lunarDate.lunarMonth
  const hourBranchIdx = time.timeIndex === 12 ? 0 : time.timeIndex
  const douJunBranch = BRANCHES[(((0 - (lunarMonth - 1) + hourBranchIdx) % 12) + 12) % 12]
  const douJunPalace = palaces[branchToIndex(douJunBranch)]

  const bodyPalace = palaces.find((p) => p.isBodyPalace)
  const lifePalace = palaces.find((p) => p.name === '命宫')

  return {
    version: 1,
    engine: 'iztro',
    basicInfo: {
      name: input.name.trim(),
      gender: input.gender,
      yinYangGender: `${yang ? '阳' : '阴'}${input.gender}`,
      calendar: input.calendar,
      solarDate: result.solarDate,
      clockTime: input.unknownTime ? '未知' : time.clockTime,
      trueSolarTime: time.trueSolarApplied ? `${time.effectiveDate} ${time.effectiveTime}` : null,
      effectiveSolarDate: time.effectiveDate,
      lunarDate: a.lunarDate,
      timeBranch: a.time,
      timeRange: a.timeRange,
      timeIndex: time.timeIndex,
      unknownTime: input.unknownTime,
      jieqiPillars: pillars(jieqi as never),
      lunarPillars: a.chineseDate,
      fiveElements: a.fiveElementsClass,
      lifeMaster: a.soul,
      bodyMaster: a.body,
      ziDouJun: douJunBranch,
      ziDouJunPalace: douJunPalace?.name ?? '',
      bodyPalace: bodyPalace?.name ?? '',
      bodyPalaceBranch: a.earthlyBranchOfBodyPalace,
      lifePalaceBranch: lifePalace?.branch ?? a.earthlyBranchOfSoulPalace,
      zodiac: a.zodiac,
      sign: a.sign,
      location: input.location,
      longitude: input.longitude,
      timezone: input.timezone,
      birthYearStem: yearStem,
      birthYearMutagens: mutagenRefs(util.getMutagensByHeavenlyStem(yearStem as never) as unknown as string[]),
      timeNotes: time.notes,
    },
    palaces,
    decades,
    annualFortunes,
  }
}

/* ===================== 文本输出（供大模型使用） ===================== */

const starText = (s: StarInfo) =>
  `${s.name}${s.brightness ? `[${s.brightness}]` : ''}${s.mutagen ? `(生年化${s.mutagen})` : ''}`

const mutText = (m: MutagenRef) =>
  `化${m.mutagen}:${m.star}${m.palaceName ? `→${m.palaceName}(${m.palaceBranch})` : '→不在盘中'}`

function palaceLabel(p: PalaceData): string {
  const flags = [p.isBodyPalace ? '身宫' : '', p.isOriginalPalace ? '来因宫' : ''].filter(Boolean)
  return `【${p.name}】${p.stem}${p.branch}${flags.length ? `（${flags.join('、')}）` : ''}`
}

/** 基本信息文本 */
export function basicInfoText(c: ChartData): string {
  const b = c.basicInfo
  const lines = [
    `姓名：${b.name}`,
    `性别：${b.gender}（${b.yinYangGender}）`,
    `公历：${b.solarDate}  钟表时间：${b.clockTime}${b.unknownTime ? '（时辰未知，按午时排盘）' : ''}`,
    `真太阳时：${b.trueSolarTime ?? '未启用'}`,
    `出生地点：${b.location || '未填写'}  地理经度：${b.longitude ?? '未填写'}  时区：UTC${b.timezone >= 0 ? '+' : ''}${b.timezone}`,
    `农历：${b.lunarDate} ${b.timeBranch}（${b.timeRange}）`,
    `节气四柱：${b.jieqiPillars}`,
    `非节气四柱：${b.lunarPillars}`,
    `五行局：${b.fiveElements}`,
    `命主：${b.lifeMaster}  身主：${b.bodyMaster}`,
    `命宫：${b.lifePalaceBranch}宫  身宫：${b.bodyPalace}（${b.bodyPalaceBranch}）`,
    `子年斗君：${b.ziDouJun}（${b.ziDouJunPalace}）`,
    `生肖：${b.zodiac}  星座：${b.sign}`,
    `生年四化（${b.birthYearStem}干）：${b.birthYearMutagens.map(mutText).join('；')}`,
  ]
  if (b.timeNotes.length) lines.push(`时间说明：${b.timeNotes.join(' ')}`)
  return lines.join('\n')
}

/** 十二宫文本 */
export function palacesText(c: ChartData): string {
  const ordered = PALACE_ORDER.map((n) => c.palaces.find((p) => p.name === n)).filter(Boolean) as PalaceData[]
  return ordered
    .map((p) => {
      const sur = p.surrounded
      const name = (i: number) => `${c.palaces[i].name}(${c.palaces[i].branch})`
      return [
        palaceLabel(p),
        `  主星：${p.majorStars.length ? p.majorStars.map(starText).join('、') : '无主星（空宫）'}`,
        `  辅星：${p.minorStars.length ? p.minorStars.map(starText).join('、') : '无'}`,
        `  杂曜：${p.adjectiveStars.length ? p.adjectiveStars.map(starText).join('、') : '无'}`,
        `  生年四化：${p.birthMutagens.length ? p.birthMutagens.map((m) => `${m.star}化${m.mutagen}`).join('、') : '无'}`,
        `  自化：${p.selfMutagens.length ? p.selfMutagens.map((m) => `${m.star}自化${m.mutagen}`).join('、') : '无'}`,
        `  宫干（${p.stem}）飞化：${p.flyingMutagens.map(mutText).join('；')}`,
        `  十二长生：${p.changsheng12}  博士十二神：${p.boshi12}  将前十二神：${p.jiangqian12}  岁前十二神：${p.suiqian12}`,
        `  大限：${p.decadal.startAge}~${p.decadal.endAge}岁`,
        `  小限虚岁：${p.minorLimitAges.slice(0, 8).join('、')}…`,
        `  流年虚岁：${p.annualAges.slice(0, 8).join('、')}…`,
        `  三方四正：对宫 ${name(sur.opposite)}，三合 ${name(sur.wealth)}、${name(sur.career)}`,
      ].join('\n')
    })
    .join('\n\n')
}

/** 单个大限文本 */
export function decadeText(c: ChartData, d: DecadeData): string {
  const starsLine = d.stars
    .map((list, i) => (list.length ? `${c.palaces[i].branch}:${list.join('、')}` : ''))
    .filter(Boolean)
    .join('；')
  const mapping = d.palaceNames
    .map((n, i) => ({ n, i }))
    .sort((x, y) => PALACE_ORDER.indexOf(x.n) - PALACE_ORDER.indexOf(y.n))
    .map(({ n, i }) => `大限${n.replace('宫', '')}=${c.palaces[i].branch}(原局${c.palaces[i].name})`)
    .join('、')
  return [
    `第${d.order + 1}大限：${d.startAge}~${d.endAge}岁（${d.startYear}~${d.endYear}年），大限命宫在${d.branch}（${d.stem}${d.branch}，原局${d.palaceName}）`,
    `  大限四化（${d.stem}干）：${d.mutagens.map(mutText).join('；')}`,
    `  大限十二宫：${mapping}`,
    `  大限星曜：${starsLine || '无'}`,
  ].join('\n')
}

/** 单个流年文本 */
export function annualText(c: ChartData, y: AnnualData): string {
  const starsLine = y.stars
    .map((list, i) => (list.length ? `${c.palaces[i].branch}:${list.join('、')}` : ''))
    .filter(Boolean)
    .join('；')
  const keys = ['财帛宫', '官禄宫', '夫妻宫', '疾厄宫', '迁移宫']
  const keyPalaces = keys
    .map((k) => {
      const i = y.palaceNames.indexOf(k)
      return i >= 0 ? `流年${k.replace('宫', '')}=${c.palaces[i].branch}(原局${c.palaces[i].name})` : ''
    })
    .filter(Boolean)
    .join('、')
  return [
    `${y.year}年 ${y.stem}${y.branch} 虚岁${y.age}：流年命宫在${y.lifePalaceBranch}（原局${y.lifePalaceOriginalName}），小限在${y.minorLimitBranch}（原局${y.minorLimitPalaceName}）`,
    `  流年四化（${y.stem}干）：${y.mutagens.map(mutText).join('；')}`,
    `  流年宫位：${keyPalaces}`,
    `  流年星曜：${starsLine || '无'}`,
  ].join('\n')
}

/** 完整命盘文本（文墨天机风格） */
export function chartToText(c: ChartData, options: { annualDecades?: number } = {}): string {
  const annualDecades = options.annualDecades ?? 8
  const parts = [
    '# 紫微斗数命盘（iztro 排盘）',
    '## 基本信息',
    basicInfoText(c),
    '## 十二宫',
    palacesText(c),
    '## 十二大限',
    c.decades.map((d) => decadeText(c, d)).join('\n\n'),
  ]
  if (annualDecades > 0) {
    parts.push(`## 流年（前${annualDecades}个大限，共${annualDecades * 10}年）`)
    for (const d of c.decades.slice(0, annualDecades)) {
      parts.push(`### 第${d.order + 1}大限 ${d.startAge}~${d.endAge}岁 流年`)
      parts.push(d.years.map((y) => annualText(c, y)).join('\n'))
    }
  }
  return parts.join('\n\n')
}

/** 用于在界面中查找星曜所在宫位文本 */
export function describeMutagens(refs: MutagenRef[]): string {
  return refs.map((m) => `${m.star}化${m.mutagen}${m.palaceName ? `（${m.palaceName}）` : ''}`).join('、')
}
