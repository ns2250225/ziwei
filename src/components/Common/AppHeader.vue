<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { NButton, NDrawer, NDrawerContent, NTooltip } from 'naive-ui'
import { House as Home, History, KeyRound, FileText, Menu, Sun, Moon, SunMoon, Palette } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const settings = useSettingsStore()
const drawer = ref(false)
const logoUrl = `${import.meta.env.BASE_URL}logo.svg`

const links = [
  { to: '/', label: '首页', icon: Home, match: (p: string) => p === '/' || p.startsWith('/chart') || p.startsWith('/analysis') },
  { to: '/history', label: '历史记录', icon: History, match: (p: string) => p.startsWith('/history') },
  { to: '/settings/api', label: 'API 设置', icon: KeyRound, match: (p: string) => p.startsWith('/settings/api') || p === '/settings' },
  { to: '/settings/prompts', label: '提示词设置', icon: FileText, match: (p: string) => p.startsWith('/settings/prompts') },
  { to: '/settings/appearance', label: '外观', icon: Palette, match: (p: string) => p.startsWith('/settings/appearance') || p.startsWith('/settings/data') },
]

const themeIcon = computed(() => {
  const t = settings.general.appearance.theme
  return t === 'dark' ? Moon : t === 'light' ? Sun : SunMoon
})
const themeLabel = computed(() => ({ light: '浅色模式', dark: '深色模式', auto: '跟随系统' })[settings.general.appearance.theme])

function cycleTheme() {
  const order = ['auto', 'light', 'dark'] as const
  const i = order.indexOf(settings.general.appearance.theme)
  settings.general.appearance.theme = order[(i + 1) % order.length]
}
</script>

<template>
  <header class="app-header">
    <div class="inner">
      <router-link to="/" class="logo serif">
        <img :src="logoUrl" alt="" width="30" height="30" />
        <span class="name">紫微命理</span>
        <span class="sub">AI 命理研究室</span>
      </router-link>
      <nav class="nav">
        <router-link
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="nav-link"
          :class="{ active: l.match(route.path) }"
        >
          <component :is="l.icon" :size="16" />
          <span>{{ l.label }}</span>
        </router-link>
      </nav>
      <div class="actions">
        <NTooltip>
          <template #trigger>
            <NButton quaternary circle @click="cycleTheme">
              <component :is="themeIcon" :size="18" />
            </NButton>
          </template>
          {{ themeLabel }}（点击切换）
        </NTooltip>
        <NButton class="menu-btn" quaternary circle @click="drawer = true">
          <Menu :size="20" />
        </NButton>
      </div>
    </div>
    <NDrawer v-model:show="drawer" placement="right" :width="240">
      <NDrawerContent title="紫微命理" closable>
        <div class="drawer-nav">
          <router-link
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            class="nav-link"
            :class="{ active: l.match(route.path) }"
            @click="drawer = false"
          >
            <component :is="l.icon" :size="18" />
            <span>{{ l.label }}</span>
          </router-link>
        </div>
      </NDrawerContent>
    </NDrawer>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}
.inner {
  max-width: 1280px;
  margin: 0 auto;
  height: 60px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 20px;
}
.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--primary);
  white-space: nowrap;
}
.logo .name {
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: 2px;
}
.logo .sub {
  font-size: 0.78rem;
  color: var(--text-muted);
  border-left: 1px solid var(--border);
  padding-left: 8px;
}
.nav {
  display: flex;
  gap: 4px;
  flex: 1;
}
.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 6px;
  color: var(--text);
  text-decoration: none;
  font-size: 0.95rem;
  white-space: nowrap;
}
.nav-link:hover {
  background: var(--primary-soft);
}
.nav-link.active {
  color: var(--primary);
  background: var(--primary-soft);
  font-weight: 600;
}
.actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.menu-btn {
  display: none;
}
.drawer-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
@media (max-width: 900px) {
  .nav {
    display: none;
  }
  .menu-btn {
    display: inline-flex;
  }
  .logo .sub {
    display: none;
  }
}
</style>
