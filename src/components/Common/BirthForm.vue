<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  NForm,
  NFormItem,
  NInput,
  NRadioGroup,
  NRadioButton,
  NDatePicker,
  NTimePicker,
  NSelect,
  NInputNumber,
  NSwitch,
  NCheckbox,
  NAlert,
  NButton,
  NSpace,
  NGrid,
  NFormItemGi,
} from 'naive-ui'
import { Sparkles, MapPin } from 'lucide-vue-next'
import type { BirthInput } from '@/types/chart'
import { CITIES, TIMEZONE_OPTIONS } from '@/utils/cities'
import { isValidSolarDate, isValidTime, resolveBirthTime, TIME_INDEX_LABELS, timeToIndex } from '@/utils/solarTime'
import { toSolarDate } from '@/services/iztro'

const props = defineProps<{ modelValue: BirthInput; loading?: boolean; editing?: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: BirthInput): void
  (e: 'submit'): void
  (e: 'reset'): void
  (e: 'cancel-edit'): void
}>()

const form = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const cityOptions = CITIES.map((c) => ({
  label: `${c.name}（${c.province}）`,
  value: c.name,
  city: c,
}))

const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
const monthOptions = LUNAR_MONTHS.map((m, i) => ({ label: `${m}月`, value: i + 1 }))
const DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]
const dayOptions = DAY_NAMES.map((d, i) => ({ label: d, value: i + 1 }))

const locationValue = computed(() => (CITIES.some((c) => c.name === form.value.location) ? form.value.location : null))

function onCity(name: string | null) {
  if (!name) {
    form.value.location = ''
    return
  }
  const c = CITIES.find((x) => x.name === name)
  if (!c) return
  form.value.location = c.name
  form.value.longitude = c.longitude
  form.value.timezone = c.timezone
}

const genderValue = computed({
  get: () => (form.value.gender as string) || null,
  set: (v) => (form.value.gender = v as BirthInput['gender']),
})

const dateValue = computed({
  get: () => form.value.solarDate || null,
  set: (v: string | null) => (form.value.solarDate = v ?? ''),
})
const timeValue = computed({
  get: () => form.value.birthTime || null,
  set: (v: string | null) => (form.value.birthTime = v ?? ''),
})

function disableFuture(ts: number) {
  return ts > Date.now() || ts < new Date('1900-01-01').getTime()
}

/** 实时时间换算预览 */
const timePreview = computed(() => {
  const f = form.value
  if (f.unknownTime) return null
  if (!isValidTime(f.birthTime)) return null
  let solar = ''
  try {
    solar = toSolarDate(f)
  } catch {
    return null
  }
  if (!isValidSolarDate(solar)) return null
  const r = resolveBirthTime({
    solarDate: solar,
    time: f.birthTime,
    useTrueSolarTime: f.useTrueSolarTime,
    longitude: f.longitude,
    timezone: f.timezone,
    daylightSaving: f.daylightSaving,
    unknownTime: false,
  })
  const clockIdx = timeToIndex(Number(f.birthTime.split(':')[0]))
  return {
    solar,
    clock: `${r.clockDate} ${r.clockTime}`,
    clockLabel: TIME_INDEX_LABELS[clockIdx],
    effective: `${r.effectiveDate} ${r.effectiveTime}`,
    effectiveLabel: TIME_INDEX_LABELS[r.timeIndex],
    changed: r.trueSolarApplied || r.dstOffsetMinutes !== 0,
    applied: r.trueSolarApplied,
    notes: r.notes,
    shifted: r.dateShifted,
    timeChanged: clockIdx !== r.timeIndex,
  }
})

const meridianTip = computed(() => {
  const m = form.value.timezone * 15
  return `时区 UTC${form.value.timezone >= 0 ? '+' : ''}${form.value.timezone} 的标准子午线为 ${Math.abs(m)}°${m >= 0 ? 'E' : 'W'}；真太阳时按“出生地经度 − 标准子午线”每度 4 分钟修正。`
})

const showLunarHint = ref(false)
watch(
  () => form.value.calendar,
  (c) => (showLunarHint.value = c === 'lunar'),
)
</script>

<template>
  <NForm label-placement="top" :show-require-mark="true" class="birth-form" @submit.prevent="emit('submit')">
    <NAlert v-if="editing" type="warning" :show-icon="true" style="margin-bottom: 14px">
      正在修改出生信息并重新排盘：提交后将更新原命盘，并清除该命盘已有的 AI 分析报告。
      <NButton text type="primary" size="small" @click="emit('cancel-edit')">取消修改</NButton>
    </NAlert>
    <NGrid :cols="24" :x-gap="16" item-responsive responsive="screen">
      <NFormItemGi :span="'24 m:12'" label="姓名" required>
        <NInput v-model:value="form.name" placeholder="命主姓名" maxlength="30" clearable />
      </NFormItemGi>
      <NFormItemGi :span="'24 m:12'" label="性别" required>
        <NRadioGroup v-model:value="genderValue">
          <NRadioButton value="男">男（乾造）</NRadioButton>
          <NRadioButton value="女">女（坤造）</NRadioButton>
        </NRadioGroup>
      </NFormItemGi>

      <NFormItemGi :span="24" label="排盘历法" required>
        <NRadioGroup v-model:value="form.calendar">
          <NRadioButton value="solar">公历</NRadioButton>
          <NRadioButton value="lunar">农历</NRadioButton>
        </NRadioGroup>
      </NFormItemGi>

      <NFormItemGi v-if="form.calendar === 'solar'" :span="'24 m:12'" label="出生日期（公历）" required>
        <NDatePicker
          v-model:formatted-value="dateValue"
          value-format="yyyy-MM-dd"
          type="date"
          placeholder="选择公历出生日期"
          :is-date-disabled="disableFuture"
          clearable
          style="width: 100%"
        />
      </NFormItemGi>
      <template v-else>
        <NFormItemGi :span="'24 m:12'" label="出生日期（农历）" required>
          <div class="lunar-row">
            <NInputNumber v-model:value="form.lunarYear" :min="1900" :max="2100" :show-button="false" placeholder="年" style="width: 100px">
              <template #suffix>年</template>
            </NInputNumber>
            <NSelect v-model:value="form.lunarMonth" :options="monthOptions" style="width: 96px" />
            <NSelect v-model:value="form.lunarDay" :options="dayOptions" style="width: 96px" />
            <NCheckbox v-model:checked="form.isLeapMonth">闰月</NCheckbox>
          </div>
        </NFormItemGi>
      </template>

      <NFormItemGi :span="'24 m:12'" label="出生时间（钟表时间）" :required="!form.unknownTime">
        <div class="time-row">
          <NTimePicker
            v-model:formatted-value="timeValue"
            value-format="HH:mm"
            format="HH:mm"
            :disabled="form.unknownTime"
            placeholder="00:00～23:59"
            style="flex: 1; min-width: 140px"
          />
          <NCheckbox v-model:checked="form.unknownTime">不知道出生时辰</NCheckbox>
        </div>
      </NFormItemGi>

      <NFormItemGi v-if="form.unknownTime" :span="24" :show-label="false">
        <NAlert type="warning" style="width: 100%">
          未知时辰模式将按午时（11:00～13:00）排盘。命宫、身宫及多数星曜位置由时辰决定，排盘与分析精度会明显下降，仅供参考。
        </NAlert>
      </NFormItemGi>

      <NFormItemGi :span="'24 m:8'" label="出生地点（可选，用于获取经度）">
        <NSelect
          :value="locationValue"
          :options="cityOptions"
          filterable
          clearable
          placeholder="搜索城市"
          @update:value="onCity"
        >
          <template #arrow><MapPin :size="14" /></template>
        </NSelect>
      </NFormItemGi>
      <NFormItemGi :span="'12 m:8'" label="地理经度（东经为正）">
        <NInputNumber v-model:value="form.longitude" :min="-180" :max="180" :step="0.01" :precision="2" placeholder="如 116.41" clearable style="width: 100%">
          <template #suffix>°</template>
        </NInputNumber>
      </NFormItemGi>
      <NFormItemGi :span="'12 m:8'" label="时区（非经度）">
        <NSelect v-model:value="form.timezone" :options="TIMEZONE_OPTIONS" />
      </NFormItemGi>
      <NFormItemGi :span="24" :show-label="false">
        <div class="muted small">{{ meridianTip }} 出生地点仅用于填充经度，经度与时区相互独立。</div>
      </NFormItemGi>

      <NFormItemGi :span="'24 m:12'" label="真太阳时">
        <NSpace align="center">
          <NSwitch v-model:value="form.useTrueSolarTime" :disabled="form.unknownTime" />
          <span class="muted small">按出生地经度与均时差校正出生时间</span>
        </NSpace>
      </NFormItemGi>
      <NFormItemGi :span="'24 m:12'" label="夏令时">
        <NSpace align="center">
          <NSwitch v-model:value="form.daylightSaving" :disabled="form.unknownTime" />
          <span class="muted small">出生时钟表处于夏令时（如中国 1986～1991 年夏季）则开启</span>
        </NSpace>
      </NFormItemGi>
    </NGrid>

    <div v-if="timePreview" class="time-preview">
      <div>
        <span class="k">原始钟表时间</span>
        <span>{{ timePreview.clock }}</span>
        <span class="muted small">{{ timePreview.clockLabel }}</span>
      </div>
      <div v-if="timePreview.changed">
        <span class="k">{{ timePreview.applied ? '换算后真太阳时' : '校正后时间' }}</span>
        <b>{{ timePreview.effective }}</b>
        <span class="small" :class="timePreview.timeChanged ? 'changed' : 'muted'">{{ timePreview.effectiveLabel }}</span>
      </div>
      <div v-if="form.calendar === 'lunar'">
        <span class="k">对应公历</span><span>{{ timePreview.solar }}</span>
      </div>
      <div v-for="n in timePreview.notes" :key="n" class="muted small">{{ n }}</div>
      <div v-if="timePreview.timeChanged" class="changed small">注意：时间校正后时辰发生变化，将以校正后的时辰排盘。</div>
    </div>

    <div class="actions">
      <NButton type="primary" size="large" attr-type="submit" :loading="loading" @click.prevent="emit('submit')">
        <template #icon><Sparkles :size="18" /></template>
        {{ editing ? '更新并重新排盘' : '开始排盘' }}
      </NButton>
      <NButton size="large" @click="emit('reset')">重置</NButton>
    </div>
  </NForm>
</template>

<style scoped>
.lunar-row,
.time-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.time-preview {
  border: 1px dashed var(--gold);
  background: var(--primary-soft);
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
  font-size: 0.92rem;
}
.time-preview .k {
  display: inline-block;
  min-width: 7.5em;
  color: var(--text-muted);
}
.time-preview span + span,
.time-preview b + span {
  margin-left: 8px;
}
.changed {
  color: var(--mut-ji);
}
.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
