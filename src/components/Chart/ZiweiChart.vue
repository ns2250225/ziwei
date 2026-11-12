<script setup lang="ts">
import { computed } from 'vue'
import type { ChartData, PalaceOverlay } from '@/types/chart'
import PalaceCard from './PalaceCard.vue'
import { GRID_POS } from '@/services/chartAdapter'

const props = defineProps<{
  chart: ChartData
  selectedPalace: number | null
  decadeOrder: number | null
  year: number | null
  theme?: string
}>()

const emit = defineEmits<{ (e: 'update:selectedPalace', v: number | null): void }>()

const decade = computed(() => (props.decadeOrder !== null ? props.chart.decades[props.decadeOrder] : null))
const annual = computed(() => (props.year !== null ? props.chart.annualFortunes.find((y) => y.year === props.year) ?? null : null))

const overlays = computed<PalaceOverlay[]>(() =>
  props.chart.palaces.map((p) => {
    const o: PalaceOverlay = {}
    const d = decade.value
    if (d) {
      o.decadalName = d.palaceNames[p.index]
      o.isDecadalLife = d.palaceIndex === p.index
      o.decadalStars = d.stars[p.index] ?? []
      o.decadalMutagens = d.mutagens.filter((m) => m.palaceIndex === p.index).map((m) => ({ star: m.star, mutagen: m.mutagen }))
    }
    const y = annual.value
    if (y) {
      o.yearlyName = y.palaceNames[p.index]
      o.isYearlyLife = y.lifePalaceIndex === p.index
      o.yearlyStars = y.stars[p.index] ?? []
      o.yearlyMutagens = y.mutagens.filter((m) => m.palaceIndex === p.index).map((m) => ({ star: m.star, mutagen: m.mutagen }))
    }
    if (props.selectedPalace !== null) {
      const sel = props.chart.palaces[props.selectedPalace]
      const fly = sel.flyingMutagens.filter((m) => m.palaceIndex === p.index && p.index !== sel.index)
      if (fly.length) o.flyIn = fly.map((m) => ({ star: m.star, mutagen: m.mutagen }))
    }
    return o
  }),
)

function highlightOf(index: number): 'target' | 'opposite' | 'surround' | null {
  if (props.selectedPalace === null) return null
  const sel = props.chart.palaces[props.selectedPalace]
  if (index === sel.index) return 'target'
  if (index === sel.surrounded.opposite) return 'opposite'
  if (index === sel.surrounded.wealth || index === sel.surrounded.career) return 'surround'
  return null
}

function onSelect(i: number) {
  emit('update:selectedPalace', i)
}

const b = computed(() => props.chart.basicInfo)
</script>

<template>
  <div class="chart-scroll">
    <div class="ziwei-chart" :class="theme ? `chart-theme-${theme}` : ''">
      <PalaceCard
        v-for="p in chart.palaces"
        :key="p.index"
        :palace="p"
        :overlay="overlays[p.index]"
        :highlight="highlightOf(p.index)"
        :style="{ gridRow: GRID_POS[p.branch][0], gridColumn: GRID_POS[p.branch][1] }"
        @select="onSelect"
      />
      <div class="center serif">
        <div class="c-name">
          {{ b.name }}
          <span class="c-gender">{{ b.yinYangGender }}</span>
        </div>
        <div class="c-grid">
          <span class="k">公历</span><span>{{ b.solarDate }} {{ b.clockTime }}</span>
          <span class="k">真太阳时</span><span>{{ b.trueSolarTime ?? '未启用' }}</span>
          <span class="k">农历</span><span>{{ b.lunarDate }} {{ b.timeBranch }}</span>
          <span class="k">节气四柱</span><span>{{ b.jieqiPillars }}</span>
          <span class="k">非节气四柱</span><span>{{ b.lunarPillars }}</span>
          <span class="k">五行局</span><span>{{ b.fiveElements }}</span>
          <span class="k">命主 / 身主</span><span>{{ b.lifeMaster }} / {{ b.bodyMaster }}</span>
          <span class="k">身宫</span><span>{{ b.bodyPalace }}（{{ b.bodyPalaceBranch }}）</span>
          <span class="k">子年斗君</span><span>{{ b.ziDouJun }}（{{ b.ziDouJunPalace }}）</span>
          <span class="k">生年四化</span>
          <span>
            <template v-for="m in b.birthYearMutagens" :key="m.star">{{ m.star }}<b :class="'m-' + m.mutagen">{{ m.mutagen }}</b> </template>
          </span>
        </div>
        <div v-if="decade || annual" class="c-horo">
          <div v-if="decade" class="dec">
            大限 {{ decade.startAge }}~{{ decade.endAge }}岁（{{ decade.startYear }}~{{ decade.endYear }}）{{ decade.stem }}{{ decade.branch }}
          </div>
          <div v-if="annual" class="yr">流年 {{ annual.year }} {{ annual.stem }}{{ annual.branch }} · 虚岁 {{ annual.age }}</div>
        </div>
        <div v-if="b.unknownTime" class="warn">时辰未知，按午时排盘，精度可能下降</div>
        <div class="legend small">
          <span><i class="lu">禄</i><i class="quan">权</i><i class="ke">科</i><i class="ji">忌</i> 生年四化</span>
          <span>↓ 自化</span>
          <span class="dl">大限</span>
          <span class="yl">流年</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.ziwei-chart {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: repeat(4, auto);
  border: 2px solid var(--chart-frame);
  background: var(--chart-bg);
  min-width: 620px;
  color: var(--text);
}
.center {
  grid-row: 2 / span 2;
  grid-column: 2 / span 2;
  border: 1px solid var(--chart-border);
  background: var(--chart-center-bg);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.84rem;
}
.c-name {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--chart-palace);
  text-align: center;
}
.c-gender {
  font-size: 0.8rem;
  margin-left: 6px;
  color: var(--text-muted);
}
.c-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 12px;
}
.k {
  color: var(--text-muted);
  white-space: nowrap;
}
.m-禄 {
  color: var(--mut-lu);
}
.m-权 {
  color: var(--mut-quan);
}
.m-科 {
  color: var(--mut-ke);
}
.m-忌 {
  color: var(--mut-ji);
}
.c-horo {
  border-top: 1px dashed var(--chart-border);
  padding-top: 6px;
}
.c-horo .dec {
  color: var(--decadal-color);
}
.c-horo .yr {
  color: var(--yearly-color);
}
.warn {
  color: var(--mut-ji);
}
.legend {
  margin-top: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  color: var(--text-muted);
}
.legend i {
  font-style: normal;
  color: #fff;
  padding: 0 2px;
  border-radius: 2px;
  margin-right: 1px;
  font-size: 0.85em;
}
.legend .lu {
  background: var(--mut-lu);
}
.legend .quan {
  background: var(--mut-quan);
}
.legend .ke {
  background: var(--mut-ke);
}
.legend .ji {
  background: var(--mut-ji);
}
.legend .dl {
  color: var(--decadal-color);
}
.legend .yl {
  color: var(--yearly-color);
}
</style>
