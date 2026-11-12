<script setup lang="ts">
import { computed } from 'vue'
import type { RenderedSection } from '@/types/reportView'

const props = defineProps<{ items: RenderedSection[]; activeId?: string }>()
const emit = defineEmits<{ (e: 'navigate', id: string): void }>()

/** 按目录分组：命格分析、十二宫、人生领域、大限、流年、关键事件、总结建议 */
const groups = computed(() => {
  const map = new Map<string, RenderedSection[]>()
  for (const it of props.items) {
    const g = it.section.group
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(it)
  }
  return Array.from(map.entries()).map(([name, items]) => ({ name, items }))
})

function go(id: string) {
  emit('navigate', id)
}
</script>

<template>
  <nav class="report-sidebar">
    <div v-for="g in groups" :key="g.name" class="group">
      <div class="g-title">{{ g.name }}</div>
      <div v-for="it in g.items" :key="it.section.id" class="sec">
        <a
          class="sec-link"
          :class="[it.section.status, { active: activeId === `sec-${it.section.id}` }]"
          @click.prevent="go(`sec-${it.section.id}`)"
        >
          <span class="dot" />
          {{ it.section.title.replace(/：.*$/, '') }}
        </a>
        <div v-if="it.toc.length" class="headings">
          <a
            v-for="h in it.toc.filter((t) => t.level <= 2)"
            :key="h.id"
            class="h-link"
            :class="{ active: activeId === h.id }"
            @click.prevent="go(h.id)"
            >{{ h.text }}</a
          >
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.report-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 0.88rem;
}
.g-title {
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 4px;
  font-size: 0.92rem;
}
.sec {
  margin-bottom: 2px;
}
.sec-link,
.h-link {
  display: block;
  cursor: pointer;
  color: var(--text);
  text-decoration: none;
  padding: 3px 8px;
  border-radius: 5px;
  line-height: 1.45;
}
.sec-link {
  display: flex;
  gap: 6px;
  align-items: baseline;
}
.sec-link:hover,
.h-link:hover {
  background: var(--primary-soft);
}
.sec-link.active,
.h-link.active {
  color: var(--primary);
  background: var(--primary-soft);
  font-weight: 600;
}
.dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--border);
  transform: translateY(-1px);
}
.done .dot {
  background: var(--mut-lu);
}
.running .dot {
  background: var(--primary);
}
.failed .dot {
  background: var(--mut-ji);
}
.headings {
  padding-left: 14px;
  border-left: 1px solid var(--border);
  margin-left: 11px;
}
.h-link {
  font-size: 0.82rem;
  color: var(--text-muted);
  padding: 2px 8px;
}
</style>
