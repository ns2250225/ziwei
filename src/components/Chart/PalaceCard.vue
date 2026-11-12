<script setup lang="ts">
import { computed } from 'vue'
import type { PalaceData, PalaceOverlay, StarInfo } from '@/types/chart'

const props = defineProps<{
  palace: PalaceData
  overlay?: PalaceOverlay
  highlight?: 'target' | 'opposite' | 'surround' | null
  compact?: boolean
}>()

const emit = defineEmits<{ (e: 'select', index: number): void }>()

const mutClass = (m: string) => ({ 禄: 'lu', 权: 'quan', 科: 'ke', 忌: 'ji' })[m] ?? ''

const selfMap = computed(() => {
  const m = new Map<string, string>()
  for (const s of props.palace.selfMutagens) m.set(s.star, s.mutagen)
  return m
})

function overlayMut(list: { star: string; mutagen: string }[] | undefined, star: StarInfo) {
  return list?.filter((m) => m.star === star.name).map((m) => m.mutagen) ?? []
}

const minorAgesText = computed(() => props.palace.minorLimitAges.slice(0, 6).join(' '))
const annualAgesText = computed(() => props.palace.annualAges.slice(0, 6).join(' '))
</script>

<template>
  <div
    class="palace"
    :class="[highlight ? `hl-${highlight}` : '', { compact }]"
    role="button"
    tabindex="0"
    @click="emit('select', palace.index)"
    @keydown.enter="emit('select', palace.index)"
  >
    <div class="stars">
      <div class="major-col">
        <template v-if="palace.majorStars.length">
          <span v-for="s in palace.majorStars" :key="s.name" class="star major">
            <span class="sn">{{ s.name }}</span>
            <span v-if="s.brightness" class="br">{{ s.brightness }}</span>
            <span v-if="s.mutagen" class="mut" :class="mutClass(s.mutagen)">{{ s.mutagen }}</span>
            <span v-if="selfMap.get(s.name)" class="mut self" :class="mutClass(selfMap.get(s.name)!)">↓{{ selfMap.get(s.name) }}</span>
            <span v-for="m in overlayMut(overlay?.decadalMutagens, s)" :key="'d' + m" class="mut dec" :class="mutClass(m)">大{{ m }}</span>
            <span v-for="m in overlayMut(overlay?.yearlyMutagens, s)" :key="'y' + m" class="mut yr" :class="mutClass(m)">流{{ m }}</span>
          </span>
        </template>
        <span v-else class="empty">空宫</span>
      </div>
      <div class="minor-col">
        <span v-for="s in palace.minorStars" :key="s.name" class="star minor">
          <span class="sn">{{ s.name }}</span>
          <span v-if="s.brightness" class="br">{{ s.brightness }}</span>
          <span v-if="s.mutagen" class="mut" :class="mutClass(s.mutagen)">{{ s.mutagen }}</span>
          <span v-if="selfMap.get(s.name)" class="mut self" :class="mutClass(selfMap.get(s.name)!)">↓{{ selfMap.get(s.name) }}</span>
          <span v-for="m in overlayMut(overlay?.decadalMutagens, s)" :key="'d' + m" class="mut dec" :class="mutClass(m)">大{{ m }}</span>
          <span v-for="m in overlayMut(overlay?.yearlyMutagens, s)" :key="'y' + m" class="mut yr" :class="mutClass(m)">流{{ m }}</span>
        </span>
      </div>
    </div>
    <div v-if="!compact" class="adj">
      <span v-for="s in palace.adjectiveStars" :key="s.name">{{ s.name }}</span>
    </div>
    <div v-if="overlay?.decadalStars?.length || overlay?.yearlyStars?.length" class="horo-stars">
      <span v-for="s in overlay?.decadalStars" :key="'ds' + s" class="ds">{{ s }}</span>
      <span v-for="s in overlay?.yearlyStars" :key="'ys' + s" class="ys">{{ s }}</span>
    </div>
    <div v-if="overlay?.flyIn?.length" class="fly">
      <span v-for="f in overlay.flyIn" :key="f.star + f.mutagen" class="mut" :class="mutClass(f.mutagen)">{{ f.star }}{{ f.mutagen }}入</span>
    </div>

    <div class="bottom">
      <div class="left-info">
        <div class="shensha" v-if="!compact">
          <span>{{ palace.boshi12 }}</span>
          <span>{{ palace.jiangqian12 }}</span>
          <span>{{ palace.suiqian12 }}</span>
        </div>
        <div class="ages" v-if="!compact">
          <span title="小限虚岁">限 {{ minorAgesText }}</span>
          <span title="流年虚岁">年 {{ annualAgesText }}</span>
        </div>
      </div>
      <div class="right-info">
        <div class="cs">{{ palace.changsheng12 }}</div>
        <div class="dec-range">{{ palace.decadal.startAge }}~{{ palace.decadal.endAge }}</div>
      </div>
    </div>
    <div class="name-row">
      <span class="pname">
        {{ palace.name }}
        <em v-if="palace.isBodyPalace" class="tag body">身</em>
        <em v-if="palace.isOriginalPalace" class="tag origin">因</em>
      </span>
      <span v-if="overlay?.decadalName" class="hname dec" :class="{ life: overlay.isDecadalLife }">大{{ overlay.decadalName.replace('宫', '') }}</span>
      <span v-if="overlay?.yearlyName" class="hname yr" :class="{ life: overlay.isYearlyLife }">流{{ overlay.yearlyName.replace('宫', '') }}</span>
      <span class="gz">{{ palace.stem }}{{ palace.branch }}</span>
    </div>
  </div>
</template>

<style scoped>
.palace {
  position: relative;
  background: var(--chart-cell-bg);
  border: 1px solid var(--chart-border);
  padding: 5px 6px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 168px;
  cursor: pointer;
  font-size: 0.78rem;
  line-height: 1.35;
  transition: background 0.15s;
  overflow: hidden;
}
.palace:hover {
  background: var(--chart-highlight);
}
.palace.hl-target {
  background: var(--chart-target);
  box-shadow: inset 0 0 0 2px var(--chart-frame);
}
.palace.hl-opposite,
.palace.hl-surround {
  background: var(--chart-highlight);
}
.palace.hl-opposite {
  box-shadow: inset 0 0 0 1px var(--chart-frame);
}
.stars {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.major-col,
.minor-col {
  display: flex;
  flex-wrap: wrap;
  gap: 1px 6px;
  align-content: flex-start;
}
.major-col {
  width: 100%;
}
.star {
  display: inline-flex;
  align-items: baseline;
  gap: 1px;
  white-space: nowrap;
}
.star.major .sn {
  color: var(--chart-major);
  font-weight: 700;
  font-size: 1.08em;
}
.star.minor .sn {
  color: var(--chart-minor);
}
.br {
  font-size: 0.82em;
  color: var(--text-muted);
}
.mut {
  display: inline-block;
  font-size: 0.78em;
  line-height: 1.3;
  padding: 0 2px;
  border-radius: 2px;
  color: #fff;
  margin-left: 1px;
  white-space: nowrap;
}
.mut.lu {
  background: var(--mut-lu);
}
.mut.quan {
  background: var(--mut-quan);
}
.mut.ke {
  background: var(--mut-ke);
}
.mut.ji {
  background: var(--mut-ji);
}
.mut.self {
  background: transparent;
  border: 1px solid currentColor;
}
.mut.self.lu {
  color: var(--mut-lu);
}
.mut.self.quan {
  color: var(--mut-quan);
}
.mut.self.ke {
  color: var(--mut-ke);
}
.mut.self.ji {
  color: var(--mut-ji);
}
.mut.dec {
  outline: 1px dashed var(--decadal-color);
}
.mut.yr {
  outline: 1px dotted var(--yearly-color);
}
.empty {
  color: var(--chart-adj);
}
.adj {
  display: flex;
  flex-wrap: wrap;
  gap: 0 5px;
  color: var(--chart-adj);
  font-size: 0.9em;
}
.horo-stars {
  display: flex;
  flex-wrap: wrap;
  gap: 0 5px;
  font-size: 0.88em;
}
.ds {
  color: var(--decadal-color);
}
.ys {
  color: var(--yearly-color);
}
.fly {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}
.bottom {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 4px;
}
.shensha,
.ages {
  display: flex;
  flex-wrap: wrap;
  gap: 0 5px;
  color: var(--text-muted);
  font-size: 0.85em;
}
.right-info {
  text-align: right;
  white-space: nowrap;
}
.cs {
  color: var(--text-muted);
  font-size: 0.9em;
}
.dec-range {
  color: var(--chart-palace);
  font-weight: 600;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 4px;
  border-top: 1px dashed var(--chart-border);
  padding-top: 2px;
}
.pname {
  color: var(--chart-palace);
  font-weight: 700;
  font-size: 1.05em;
  white-space: nowrap;
}
.tag {
  font-style: normal;
  font-size: 0.75em;
  padding: 0 3px;
  border-radius: 3px;
  margin-left: 2px;
  color: #fff;
  vertical-align: 1px;
}
.tag.body {
  background: var(--chart-frame);
}
.tag.origin {
  background: var(--gold);
}
.hname {
  font-size: 0.85em;
  padding: 0 3px;
  border-radius: 3px;
  white-space: nowrap;
}
.hname.dec {
  color: var(--decadal-color);
  border: 1px solid var(--decadal-color);
}
.hname.yr {
  color: var(--yearly-color);
  border: 1px solid var(--yearly-color);
}
.hname.life {
  color: #fff;
}
.hname.dec.life {
  background: var(--decadal-color);
}
.hname.yr.life {
  background: var(--yearly-color);
}
.gz {
  margin-left: auto;
  color: var(--text-muted);
  font-weight: 600;
}
.compact {
  min-height: 0;
}
</style>
