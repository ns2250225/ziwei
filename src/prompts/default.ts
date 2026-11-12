import type { PromptTemplate } from '@/types/report'
import { BASIC_STAGE_PROMPT, LIFE_STAGE_PROMPT } from './palace'
import { DECADE_STAGE_PROMPT } from './decade'
import { ANNUAL_STAGE_PROMPT, CUSTOM_STAGE_PROMPT, SUMMARY_STAGE_PROMPT } from './annual'

export const DEFAULT_TEMPLATE_ID = 'builtin-default'

export const DEFAULT_SYSTEM_PROMPT =
  '你是一位资深紫微斗数研究专家，熟悉三合紫微、飞星紫微、河洛紫微、钦天四化等流派。你只依据用户提供的命盘数据进行解释与推演，不自行计算或编造命盘。输出使用结构清晰的简体中文 Markdown。'

export const DEFAULT_CONTENT = `# 紫微斗数命盘专业分析提示词

你现在是一位资深的国学易经术数领域专家，熟悉三合紫微、飞星紫微、河洛紫微、钦天四化等不同紫微斗数流派。

请根据下面提供的紫微斗数命盘信息，对命主进行全面、细致、系统的分析。

## 一、分析基本要求

1. 以提供的命盘数据为分析依据，不得自行编造星曜、宫位、四化或流年信息。
2. 综合使用三合紫微、飞星紫微、河洛紫微、钦天四化等分析技法。
3. 分析十二宫星曜分布、宫位之间的关联、限流叠宫和飞宫四化。
4. 区分原局、大限、流年三个层次。
5. 对存在不同流派解释的地方，说明采用的分析口径。
6. 对信息不足或无法判断的内容明确说明，不要强行推断。

## 二、十二宫分析

逐一分析以下十二宫：

- 命宫
- 兄弟宫
- 夫妻宫
- 子女宫
- 财帛宫
- 疾厄宫
- 迁移宫
- 交友宫
- 官禄宫
- 田宅宫
- 福德宫
- 父母宫

分析每个宫位的：

- 主星及辅星组合
- 星曜庙旺利陷
- 生年四化
- 自化与对宫化入
- 三方四正
- 宫位之间的相互影响
- 现实生活中的可能表现

## 三、人生领域分析

全面分析命主以下方面：

1. 性格与天赋
2. 学业与学习能力
3. 事业发展与职业方向
4. 财富与收入结构
5. 人际关系与贵人
6. 婚姻与感情
7. 健康与生活习惯
8. 家庭与房产

每个领域均需给出：

- 命盘依据
- 有利因素
- 不利因素
- 发展趋势
- 实际建议

## 四、大限分析

详细分析命盘提供的十二个大限。

每个大限需要分析：

- 大限所在宫位
- 大限四化
- 大限对原局的影响
- 事业、财运、感情、家庭等变化
- 该阶段的主要机会和挑战

## 五、前八个大限流年分析

对前八个大限的所有流年逐年分析，共80个流年。

每年必须包含：

- 公历年份
- 对应虚岁
- 流年命宫
- 流年四化
- 重点影响宫位
- 事业、财运、感情、健康等关注事项
- 可能出现的机会和风险
- 建议采取的应对策略

请使用表格或按年份分节的形式组织内容。

不要遗漏任何一年。

## 六、关键事件分析

对可能的重要人生阶段进行归纳，给出：

- 可能发生的时间范围
- 主要涉及领域
- 吉凶倾向
- 影响程度（低、中、高）
- 命盘依据
- 实际建议

注意：命理推演属于传统文化解释，不应将推断描述为确定会发生的现实事件。

## 七、总结

最后给出：

- 命主整体命格特点
- 人生发展优势
- 需要重点注意的问题
- 未来十年的趋势概述
- 可执行的生活建议

请使用结构清晰的 Markdown 格式输出。

## 八、重要提醒

本分析仅供传统文化研究和娱乐参考，不构成医疗、投资、婚姻、法律等专业建议。

---

## 命盘信息

{{CHART_DATA}}
`

export function createDefaultTemplate(): PromptTemplate {
  return {
    id: DEFAULT_TEMPLATE_ID,
    name: '默认分析模板',
    builtin: true,
    system: DEFAULT_SYSTEM_PROMPT,
    content: DEFAULT_CONTENT,
    stages: {
      basic: BASIC_STAGE_PROMPT,
      life: LIFE_STAGE_PROMPT,
      decade: DECADE_STAGE_PROMPT,
      annual: ANNUAL_STAGE_PROMPT,
      summary: SUMMARY_STAGE_PROMPT,
      custom: CUSTOM_STAGE_PROMPT,
    },
    customItems: '',
    updatedAt: Date.now(),
  }
}

/** 提示词中可用的变量说明 */
export const PROMPT_VARIABLES: { key: string; desc: string }[] = [
  { key: '{{CHART_DATA}}', desc: '完整命盘文本（基本信息、十二宫、十二大限、前八大限流年）' },
  { key: '{{NAME}}', desc: '命主姓名' },
  { key: '{{GENDER}}', desc: '命主性别' },
  { key: '{{CURRENT_YEAR}}', desc: '当前公历年份' },
  { key: '{{CUSTOM_ITEMS}}', desc: '自定义分析项目' },
  { key: '{{DECADE_FROM}} / {{DECADE_TO}}', desc: '大限阶段：本次分析的起止大限序号' },
  { key: '{{DECADE_LIST}}', desc: '大限阶段：本次分析的大限数据' },
  { key: '{{DECADE_NO}}', desc: '流年阶段：大限序号' },
  { key: '{{DECADE_RANGE}}', desc: '流年阶段：大限年龄与年份区间' },
  { key: '{{DECADE_INFO}}', desc: '流年阶段：所属大限数据' },
  { key: '{{YEAR_FROM}} / {{YEAR_TO}}', desc: '流年阶段：本次分析的起止年份' },
  { key: '{{YEAR_COUNT}}', desc: '流年阶段：本次分析的年数' },
  { key: '{{ANNUAL_DATA}}', desc: '流年阶段：本批流年数据' },
  { key: '{{PREVIOUS_RESULTS}}', desc: '总结阶段：前序阶段结果摘要' },
]
