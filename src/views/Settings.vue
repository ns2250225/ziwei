<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NTabs, NTabPane } from 'naive-ui'
import ApiSettings from '@/components/Settings/ApiSettings.vue'
import PromptSettings from '@/components/Settings/PromptSettings.vue'
import AppearanceSettings from '@/components/Settings/AppearanceSettings.vue'

const route = useRoute()
const router = useRouter()

const tab = computed({
  get: () => {
    const t = String(route.params.tab || 'api')
    return ['api', 'prompts', 'appearance'].includes(t) ? t : 'api'
  },
  set: (v: string) => router.replace({ path: `/settings/${v}` }),
})
</script>

<template>
  <div class="page">
    <div class="page-title serif">系统设置</div>
    <NTabs v-model:value="tab" type="segment" animated class="tabs">
      <NTabPane name="api" tab="API 设置">
        <ApiSettings />
      </NTabPane>
      <NTabPane name="prompts" tab="提示词设置">
        <PromptSettings :key="String(route.query.template || '')" />
      </NTabPane>
      <NTabPane name="appearance" tab="外观与数据">
        <AppearanceSettings />
      </NTabPane>
    </NTabs>
  </div>
</template>

<style scoped>
.tabs :deep(.n-tabs-nav) {
  max-width: 520px;
  margin-bottom: 14px;
}
</style>
