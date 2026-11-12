import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior(_to, _from, saved) {
    return saved ?? { top: 0 }
  },
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/Home.vue'), meta: { title: '首页' } },
    { path: '/chart/:id', name: 'chart', component: () => import('@/views/Chart.vue'), meta: { title: '命盘' } },
    { path: '/share', name: 'share', component: () => import('@/views/Chart.vue'), meta: { title: '分享命盘' } },
    { path: '/analysis/:id', name: 'analysis', component: () => import('@/views/Analysis.vue'), meta: { title: 'AI 分析' } },
    { path: '/history', name: 'history', component: () => import('@/views/History.vue'), meta: { title: '历史记录' } },
    { path: '/settings/:tab?', name: 'settings', component: () => import('@/views/Settings.vue'), meta: { title: '设置' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.afterEach((to) => {
  const t = (to.meta?.title as string) || ''
  document.title = t ? `${t} · 紫微命理` : '紫微命理 · AI 命理研究室'
})

export default router
