<script setup lang="ts">
import { computed } from 'vue'
import { NDescriptions, NDescriptionsItem, NTag, NDivider } from 'naive-ui'
import type { ChartData, StarInfo } from '@/types/chart'

const props = defineProps<{ chart: ChartData; index: number; decadeOrder: number | null; year: number | null }>()

const p = computed(() => props.chart.palaces[props.index])
const name = (i: number) => `${props.chart.palaces[i].name}（${props.chart.palaces[i].stem}${props.chart.palaces[i].branch}）`

const typeLabel: Record<string, string> = {
  major: '主星',
  soft: '吉星',
  tough: '煞星',
  adjective: '杂曜',
  flower: '桃花星',
  helper: '解神',
  lucun: '禄存',
  tianma: '天马',
}

const mutType = (m: string) => (({ 禄: 'success', 权: 'warning', 科: 'info', 忌: 'error' }) as const)[m as '禄'] ?? 'default'

const allStars = computed<StarInfo[]>(() => [...p.value.majorStars, ...p.value.minorStars, ...p.value.adjectiveStars])

/** 他宫宫干四化飞入本宫 */
const flyInto = computed(() =>
  props.chart.palaces.flatMap((o) =>
    o.index === p.value.index
      ? []
      : o.flyingMutagens.filter((m) => m.palaceIndex === p.value.index).map((m) => ({ from: o.name, ...m })),
  ),
)
/** 对宫化入 */
const oppositeIn = computed(() => {
  const opp = props.chart.palaces[p.value.surrounded.opposite]
  return opp.flyingMutagens.filter((m) => m.palaceIndex === p.value.index)
})

const decade = computed(() => (props.decadeOrder !== null ? props.chart.decades[props.decadeOrder] : null))
const annual = computed(() => (props.year !== null ? props.chart.annualFortunes.find((y) => y.year === props.year) : null))
</script>

<template>
  <div class="palace-detail">
    <div class="head">
      <span class="title serif">{{ p.name }}</span>
      <NTag size="small" :bordered="false">{{ p.stem }}{{ p.branch }}</NTag>
      <NTag v-if="p.isBodyPalace" size="small" type="error">身宫</NTag>
      <NTag v-if="p.isOriginalPalace" size="small" type="warning">来因宫</NTag>
    </div>

    <NDivider title-placement="left">星曜</NDivider>
    <div class="star-table">
      <div v-for="s in allStars" :key="s.name" class="row">
        <span class="sname" :class="s.type">{{ s.name }}</span>
        <span class="muted small">{{ typeLabel[s.type] ?? s.type }}</span>
        <span>{{ s.brightness || '—' }}</span>
        <span>
          <NTag v-if="s.mutagen" size="tiny" :type="mutType(s.mutagen)">生年化{{ s.mutagen }}</NTag>
        </span>
      </div>
      <div v-if="!allStars.length" class="muted">无星曜</div>
    </div>
    <div v-if="!p.majorStars.length" class="muted small" style="margin-top: 6px">
      本宫无主星（空宫），传统上借对宫 {{ name(p.surrounded.opposite) }} 主星论。
    </div>

    <NDivider title-placement="left">四化</NDivider>
    <NDescriptions :column="1" label-placement="left" size="small" bordered>
      <NDescriptionsItem label="生年四化">
        <span v-if="p.birthMutagens.length">
          <NTag v-for="m in p.birthMutagens" :key="m.star" size="small" :type="mutType(m.mutagen)" style="margin-right: 4px">
            {{ m.star }}化{{ m.mutagen }}
          </NTag>
        </span>
        <span v-else class="muted">无</span>
      </NDescriptionsItem>
      <NDescriptionsItem label="自化">
        <span v-if="p.selfMutagens.length">
          <NTag v-for="m in p.selfMutagens" :key="m.star" size="small" :type="mutType(m.mutagen)" style="margin-right: 4px">
            {{ m.star }}自化{{ m.mutagen }}
          </NTag>
        </span>
        <span v-else class="muted">无</span>
      </NDescriptionsItem>
      <NDescriptionsItem :label="`宫干（${p.stem}）飞化`">
        <div v-for="m in p.flyingMutagens" :key="m.mutagen">
          <NTag size="tiny" :type="mutType(m.mutagen)">化{{ m.mutagen }}</NTag>
          {{ m.star }} → {{ m.palaceName || '不在盘中' }}{{ m.palaceBranch ? `（${m.palaceBranch}）` : '' }}
        </div>
      </NDescriptionsItem>
      <NDescriptionsItem label="对宫化入">
        <span v-if="oppositeIn.length">{{ oppositeIn.map((m) => `${m.star}化${m.mutagen}`).join('、') }}</span>
        <span v-else class="muted">无</span>
      </NDescriptionsItem>
      <NDescriptionsItem label="他宫飞入">
        <div v-if="flyInto.length">
          <div v-for="m in flyInto" :key="m.from + m.mutagen">{{ m.from }} → {{ m.star }}化{{ m.mutagen }}</div>
        </div>
        <span v-else class="muted">无</span>
      </NDescriptionsItem>
    </NDescriptions>

    <NDivider title-placement="left">三方四正</NDivider>
    <NDescriptions :column="1" label-placement="left" size="small" bordered>
      <NDescriptionsItem label="本宫">{{ name(p.index) }}</NDescriptionsItem>
      <NDescriptionsItem label="对宫">{{ name(p.surrounded.opposite) }}</NDescriptionsItem>
      <NDescriptionsItem label="三合">{{ name(p.surrounded.wealth) }}、{{ name(p.surrounded.career) }}</NDescriptionsItem>
    </NDescriptions>

    <NDivider title-placement="left">运限与神煞</NDivider>
    <NDescriptions :column="1" label-placement="left" size="small" bordered>
      <NDescriptionsItem label="大限">{{ p.decadal.startAge }} ~ {{ p.decadal.endAge }} 岁</NDescriptionsItem>
      <NDescriptionsItem label="小限虚岁">{{ p.minorLimitAges.join('、') }}</NDescriptionsItem>
      <NDescriptionsItem label="流年虚岁">{{ p.annualAges.slice(0, 10).join('、') }}</NDescriptionsItem>
      <NDescriptionsItem label="十二长生">{{ p.changsheng12 }}</NDescriptionsItem>
      <NDescriptionsItem label="博士十二神">{{ p.boshi12 }}</NDescriptionsItem>
      <NDescriptionsItem label="将前十二神">{{ p.jiangqian12 }}</NDescriptionsItem>
      <NDescriptionsItem label="岁前十二神">{{ p.suiqian12 }}</NDescriptionsItem>
    </NDescriptions>

    <template v-if="decade || annual">
      <NDivider title-placement="left">当前运限叠宫</NDivider>
      <NDescriptions :column="1" label-placement="left" size="small" bordered>
        <NDescriptionsItem v-if="decade" label="大限宫位">
          大限{{ decade.palaceNames[p.index] }}
          <span v-if="decade.stars[p.index]?.length" class="muted">（{{ decade.stars[p.index].join('、') }}）</span>
        </NDescriptionsItem>
        <NDescriptionsItem v-if="annual" label="流年宫位">
          流年{{ annual.palaceNames[p.index] }}
          <span v-if="annual.stars[p.index]?.length" class="muted">（{{ annual.stars[p.index].join('、') }}）</span>
        </NDescriptionsItem>
      </NDescriptions>
    </template>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--chart-palace);
}
.star-table .row {
  display: grid;
  grid-template-columns: 5em 4em 3em 1fr;
  gap: 6px;
  padding: 3px 0;
  border-bottom: 1px dashed var(--border);
  align-items: center;
}
.sname {
  font-weight: 600;
}
.sname.major {
  color: var(--chart-major);
}
.sname.soft,
.sname.lucun,
.sname.tianma {
  color: var(--chart-minor);
}
.sname.tough {
  color: var(--mut-ji);
}
</style>
