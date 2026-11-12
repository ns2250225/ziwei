<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NTag } from 'naive-ui'
import { useSettingsStore } from '@/stores/settings'
import { resolveEndpoint } from '@/services/aiClient'

defineProps<{ compact?: boolean }>()
const router = useRouter()
const settings = useSettingsStore()
const api = computed(() => settings.defaultApi)
const maskedKey = computed(() => {
  const k = api.value?.apiKey ?? ''
  if (!k) return '未填写'
  return k.length <= 8 ? '••••' : `${k.slice(0, 3)}••••${k.slice(-4)}`
})
</script>

<template>
  <div class="api-status">
    <template v-if="api">
      <div class="row">
        <NTag :type="settings.apiReady ? 'success' : 'warning'" size="small">{{ settings.apiReady ? '已配置' : '配置不完整' }}</NTag>
        <b>{{ api.name }}</b>
      </div>
      <template v-if="!compact">
        <div class="muted small">模型：{{ api.model || '未填写' }}</div>
        <div class="muted small ellipsis">接口：{{ resolveEndpoint(api) || '未填写' }}</div>
        <div class="muted small">密钥：{{ maskedKey }} · {{ api.stream ? '流式输出' : '非流式' }}</div>
      </template>
    </template>
    <template v-else>
      <div class="row">
        <NTag type="warning" size="small">未配置</NTag>
        <span class="muted small">排盘无需 API；AI 分析需先配置大模型 API。</span>
      </div>
    </template>
    <NButton v-if="!compact" size="small" secondary block style="margin-top: 8px" @click="router.push('/settings/api')">
      {{ api ? '管理 API 配置' : '去配置 API' }}
    </NButton>
  </div>
</template>

<style scoped>
.api-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
