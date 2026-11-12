<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  NLoadingBarProvider,
  darkTheme,
  zhCN,
  dateZhCN,
  useOsTheme,
  type GlobalThemeOverrides,
} from 'naive-ui'
import AppHeader from '@/components/Common/AppHeader.vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const osTheme = useOsTheme()

const isDark = computed(() => {
  const t = settings.general.appearance.theme
  return t === 'dark' || (t === 'auto' && osTheme.value === 'dark')
})

const widthMap = { narrow: '720px', medium: '880px', wide: '1080px', full: '100%' }

watchEffect(() => {
  const root = document.documentElement
  root.classList.toggle('dark', isDark.value)
  root.style.setProperty('--font-size-base', `${settings.general.appearance.fontSize}px`)
  root.style.setProperty('--reading-width', widthMap[settings.general.appearance.readingWidth] ?? '880px')
})

const overrides = computed<GlobalThemeOverrides>(() => {
  const primary = isDark.value ? '#E8936A' : '#9A3412'
  const hover = isDark.value ? '#F0A57F' : '#B4441C'
  const pressed = isDark.value ? '#D07B52' : '#7C2D12'
  return {
    common: {
      primaryColor: primary,
      primaryColorHover: hover,
      primaryColorPressed: pressed,
      primaryColorSuppl: hover,
      borderRadius: '6px',
      fontSize: `${settings.general.appearance.fontSize}px`,
      fontSizeMedium: `${settings.general.appearance.fontSize}px`,
      bodyColor: isDark.value ? '#16130F' : '#F7F3EC',
      cardColor: isDark.value ? '#1F1B16' : '#FFFDF9',
      modalColor: isDark.value ? '#1F1B16' : '#FFFDF9',
      popoverColor: isDark.value ? '#262019' : '#FFFFFF',
    },
  }
})
</script>

<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="overrides" :locale="zhCN" :date-locale="dateZhCN">
    <NLoadingBarProvider>
      <NDialogProvider>
        <NNotificationProvider>
          <NMessageProvider>
            <AppHeader />
            <main class="app-main">
              <router-view />

            </main>
            <footer class="app-footer muted small">
              紫微 AI 命理研究室 · 排盘引擎 iztro · 纯前端运行，数据保存在本地浏览器 · 仅供传统文化研究与娱乐参考
            </footer>
          </NMessageProvider>
        </NNotificationProvider>
      </NDialogProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>

<style scoped>
.app-main {
  min-height: calc(100vh - 120px);
}
.app-footer {
  text-align: center;
  padding: 18px 16px 28px;
  border-top: 1px solid var(--border);
}
</style>
