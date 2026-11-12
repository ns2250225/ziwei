<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NButton, NAlert, NEmpty, NTag, useMessage, useDialog } from 'naive-ui'
import { History, Sparkles, KeyRound, ChevronRight, ShieldCheck } from 'lucide-vue-next'
import BirthForm from '@/components/Common/BirthForm.vue'
import ApiStatus from '@/components/Common/ApiStatus.vue'
import type { BirthInput } from '@/types/chart'
import { emptyBirthInput, exampleBirthInput, useChartStore } from '@/stores/chart'
import { useSettingsStore } from '@/stores/settings'
import { validateBirthInput } from '@/services/iztro'
import { formatDateTime } from '@/utils/common'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const chartStore = useChartStore()
const settings = useSettingsStore()

const form = ref<BirthInput>(chartStore.draft ? { ...chartStore.draft } : emptyBirthInput())
const loading = ref(false)

onMounted(() => {
  chartStore.loadRecent(6)
})

async function submit() {
  const errors = validateBirthInput(form.value)
  if (errors.length) {
    dialog.warning({ title: '请检查出生信息', content: errors.join('\n'), positiveText: '知道了' })
    return
  }
  loading.value = true
  try {
    const rec = await chartStore.create(form.value)
    chartStore.draft = null
    message.success('排盘完成')
    router.push(`/chart/${rec.id}`)
  } catch (e) {
    dialog.error({ title: '排盘失败', content: (e as Error).message, positiveText: '知道了' })
  } finally {
    loading.value = false
  }
}

function reset() {
  form.value = emptyBirthInput()
  chartStore.cancelEdit()
}

function cancelEdit() {
  chartStore.cancelEdit()
  form.value = emptyBirthInput()
}

async function loadExample() {
  chartStore.cancelEdit()
  form.value = exampleBirthInput()
  await submit()
}

function ackPrivacy() {
  settings.general.privacyAcknowledged = true
}
</script>

<template>
  <div class="page home">
    <section class="hero serif">
      <div class="hero-text">
        <h1>紫微 AI 命理研究室</h1>
        <p>iztro 专业排盘 · 十二宫 / 四化 / 大限 / 流年完整呈现 · 自定义大模型深度解读</p>
      </div>
    </section>

    <NAlert v-if="!settings.general.privacyAcknowledged" type="info" closable class="privacy" @close="ackPrivacy">
      <template #icon><ShieldCheck :size="20" /></template>
      本站为纯前端应用：排盘计算在浏览器本地完成，出生信息与历史记录仅保存在本地浏览器。只有当你主动发起 AI 分析时，命盘数据才会发送给你自行配置的大模型服务，第三方模型服务可能处理并保存请求数据。
    </NAlert>

    <div class="layout">
      <NCard class="form-card" :bordered="false">
        <template #header>
          <div class="card-title"><Sparkles :size="18" /> 出生信息</div>
        </template>
        <BirthForm
          v-model="form"
          :loading="loading"
          :editing="!!chartStore.editingId"
          @submit="submit"
          @reset="reset"
          @cancel-edit="cancelEdit"
        />
      </NCard>

      <aside class="side">
        <NCard :bordered="false" size="small">
          <template #header>
            <div class="card-title"><KeyRound :size="16" /> API 配置状态</div>
          </template>
          <ApiStatus />
        </NCard>

        <NCard :bordered="false" size="small">
          <template #header>
            <div class="card-title"><Sparkles :size="16" /> 示例命盘</div>
          </template>
          <p class="muted small" style="margin-top: 0">示例：1993-02-26 22:20 男，北京，启用真太阳时。可直接体验排盘与分析流程。</p>
          <NButton block secondary type="primary" :loading="loading" @click="loadExample">查看示例命盘</NButton>
        </NCard>

        <NCard :bordered="false" size="small">
          <template #header>
            <div class="card-title"><History :size="16" /> 最近排盘</div>
          </template>
          <template #header-extra>
            <NButton text size="small" @click="router.push('/history')">全部 <ChevronRight :size="14" /></NButton>
          </template>
          <NEmpty v-if="!chartStore.recent.length" description="暂无排盘记录" size="small" />
          <div v-else class="recent">
            <router-link v-for="r in chartStore.recent" :key="r.id" :to="`/chart/${r.id}`" class="recent-item">
              <div class="r-main">
                <b>{{ r.basicInfo.name }}</b>
                <NTag size="tiny" :bordered="false">{{ r.basicInfo.gender }}</NTag>
                <span class="muted small">{{ r.chartData.basicInfo.solarDate }} {{ r.chartData.basicInfo.clockTime }}</span>
              </div>
              <div class="muted small">{{ r.chartData.basicInfo.fiveElements }} · 命主{{ r.chartData.basicInfo.lifeMaster }} · {{ formatDateTime(r.createdAt) }}</div>
            </router-link>
          </div>
        </NCard>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.hero {
  border-radius: 14px;
  padding: 28px 28px;
  margin-bottom: 18px;
  color: #fdf6e3;
  background:
    radial-gradient(circle at 85% 20%, rgba(252, 211, 77, 0.35) 0, transparent 40%),
    radial-gradient(circle at 10% 90%, rgba(252, 211, 77, 0.18) 0, transparent 35%),
    linear-gradient(135deg, #5b1a0b 0%, #7c2d12 45%, #3b1306 100%);
  position: relative;
  overflow: hidden;
}
.hero::after {
  content: '紫微';
  position: absolute;
  right: 24px;
  bottom: -30px;
  font-size: 120px;
  opacity: 0.08;
  letter-spacing: 10px;
}
.hero h1 {
  margin: 0 0 8px;
  font-size: 1.9rem;
  letter-spacing: 4px;
}
.hero p {
  margin: 0;
  opacity: 0.9;
}
.privacy {
  margin-bottom: 16px;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 18px;
  align-items: start;
}
.side {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
}
.recent {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.recent-item {
  display: block;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  text-decoration: none;
  color: var(--text);
}
.recent-item:hover {
  border-color: var(--primary);
  background: var(--primary-soft);
}
.r-main {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .hero {
    padding: 20px 18px;
  }
  .hero h1 {
    font-size: 1.4rem;
  }
}
</style>
