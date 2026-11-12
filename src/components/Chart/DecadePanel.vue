<script setup lang="ts">
import { computed } from 'vue'
import { NCollapse, NCollapseItem, NTag } from 'naive-ui'
import type { ChartData, MutagenRef } from '@/types/chart'

const props = defineProps<{ chart: ChartData; decadeOrder: number | null; year: number | null }>()
const emit = defineEmits<{
  (e: 'update:decadeOrder', v: number | null): void
  (e: 'update:year', v: number | null): void
}>()

const currentYear = new Date().getFullYear()
const mutType = (m: string) => (({ 禄: 'success', 权: 'warning', 科: 'info', 忌: 'error' }) as const)[m as '禄'] ?? 'default'
const mutText = (m: MutagenRef) => `${m.star}${m.mutagen}`

const expanded = computed(() => (props.decadeOrder !== null ? [String(props.decadeOrder)] : []))

function onExpand(names: Array<string | number>) {
  const last = names.length ? Number(names[names.length - 1]) : null
  emit('update:decadeOrder', last)
  if (last === null || !props.chart.decades[last].years.some((y) => y.year === props.year)) emit('update:year', null)
}

function pickYear(order: number, year: number) {
  emit('update:decadeOrder', order)
  emit('update:year', props.year === year ? null : year)
}

const selectedAnnual = computed(() => (props.year !== null ? props.chart.annualFortunes.find((y) => y.year === props.year) : null))

/** 流年对应宫位：流年十二宫 → 原局宫位 */
const annualMapping = computed(() => {
  const y = selectedAnnual.value
  if (!y) return []
  return y.palaceNames
    .map((n, i) => ({ yearly: n, original: props.chart.palaces[i].name, branch: props.chart.palaces[i].branch }))
    .sort((a, b) => ORDER.indexOf(a.yearly) - ORDER.indexOf(b.yearly))
})
const ORDER = ['命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫', '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫']
</script>

<template>
  <div class="decade-panel">
    <NCollapse :expanded-names="expanded" accordion @update:expanded-names="onExpand">
      <NCollapseItem v-for="d in chart.decades" :key="d.order" :name="String(d.order)">
        <template #header>
          <div class="d-head">
            <span class="d-no">第{{ d.order + 1 }}大限</span>
            <span>{{ d.startAge }}~{{ d.endAge }}岁</span>
            <span class="muted">{{ d.startYear }}~{{ d.endYear }}</span>
            <span class="d-palace">{{ d.stem }}{{ d.branch }} · {{ d.palaceName }}</span>
            <NTag v-if="currentYear >= d.startYear && currentYear <= d.endYear" size="tiny" type="primary">当前</NTag>
          </div>
        </template>
        <div class="d-mut">
          大限四化：
          <NTag v-for="m in d.mutagens" :key="m.mutagen" size="small" :type="mutType(m.mutagen)" style="margin: 2px 4px 2px 0">
            {{ mutText(m) }}{{ m.palaceName ? ` → ${m.palaceName}` : '' }}
          </NTag>
        </div>
        <div class="years">
          <button
            v-for="y in d.years"
            :key="y.year"
            class="year-btn"
            :class="{ active: year === y.year, now: y.year === currentYear }"
            @click="pickYear(d.order, y.year)"
          >
            <span class="y">{{ y.year }}</span>
            <span class="gz">{{ y.stem }}{{ y.branch }}</span>
            <span class="age">{{ y.age }}岁</span>
          </button>
        </div>
        <div v-if="selectedAnnual && selectedAnnual.decadeOrder === d.order" class="annual-detail">
          <div class="a-title">
            {{ selectedAnnual.year }}年（{{ selectedAnnual.stem }}{{ selectedAnnual.branch }}）· 虚岁 {{ selectedAnnual.age }}
          </div>
          <div>
            流年命宫：<b>{{ selectedAnnual.lifePalaceBranch }}</b>（原局{{ selectedAnnual.lifePalaceOriginalName }}）
            　小限：{{ selectedAnnual.minorLimitBranch }}（{{ selectedAnnual.minorLimitPalaceName }}）
          </div>
          <div>
            流年四化：
            <NTag v-for="m in selectedAnnual.mutagens" :key="m.mutagen" size="small" :type="mutType(m.mutagen)" style="margin: 2px 4px 2px 0">
              {{ mutText(m) }}{{ m.palaceName ? ` → ${m.palaceName}` : '' }}
            </NTag>
          </div>
          <div class="mapping">
            <span v-for="m in annualMapping" :key="m.yearly" class="map-item">
              <b>流{{ m.yearly.replace('宫', '') }}</b> {{ m.branch }}·{{ m.original.replace('宫', '') }}
            </span>
          </div>
        </div>
      </NCollapseItem>
    </NCollapse>
  </div>
</template>

<style scoped>
.d-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
}
.d-no {
  font-weight: 700;
  color: var(--decadal-color);
}
.d-palace {
  color: var(--chart-palace);
}
.d-mut {
  margin-bottom: 8px;
}
.years {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}
.year-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 2px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-elevated);
  color: var(--text);
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1.3;
}
.year-btn:hover {
  border-color: var(--yearly-color);
}
.year-btn.active {
  background: var(--yearly-color);
  border-color: var(--yearly-color);
  color: #fff;
}
.year-btn.now:not(.active) {
  border-color: var(--primary);
}
.year-btn .y {
  font-weight: 700;
}
.year-btn .gz,
.year-btn .age {
  font-size: 0.8em;
  opacity: 0.85;
}
.annual-detail {
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid var(--yearly-color);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9rem;
}
.a-title {
  font-weight: 700;
  color: var(--yearly-color);
}
.mapping {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 2px 8px;
  font-size: 0.85em;
}
.map-item b {
  color: var(--yearly-color);
}
@media (max-width: 520px) {
  .years {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
