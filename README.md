# 紫微命理 · AI 命理研究室

基于 [iztro](https://github.com/SylarLong/iztro) 排盘引擎与用户自定义大模型 API 的纯前端紫微斗数分析工具。

**纯前端、无后端、开箱即用**：所有排盘计算、报告渲染、数据存储均在浏览器本地完成；AI 分析直连你自己配置的大模型 API（OpenAI 兼容接口），Key 与命盘数据不经过任何第三方服务器。

## ✨ 功能特性

### 🎴 排盘
- 公历 / 农历双历输入，支持**未知时辰**模式
- 出生地点自动映射经度，时区与经度分离
- **真太阳时**修正（经度修正 + 均时差）、夏令时处理、跨日校验

### 📊 命盘展示
- 传统 4×4 十二宫布局 / 列表视图
- 主星、辅星、杂曜、亮度、生年四化、自化、十二长生、博士 / 将前 / 岁前十二神、大限、小限、流年年龄
- 点击宫位高亮**三方四正**并显示宫干飞化
- 十二大限与十年流年叠宫显示
- 基本信息：农历、节气四柱 / 非节气四柱、五行局、命主、身主、身宫、子年斗君、生年四化

### 🔌 API 配置
- 多套配置管理、默认配置切换
- Base URL 自动补全 / 完整地址两种写法
- Temperature / Top P 可关闭、Token 参数名切换（max_tokens / max_completion_tokens）
- 超时、额外请求头自定义
- 一键连接测试，错误智能归类（URL、Key、模型、CORS、超时、Token 超限）

### 📝 提示词
- 内置默认模板 + 多模板管理
- Markdown 编辑器（分屏实时预览）、系统角色设定
- 分阶段规则、自定义分析项目
- 导入 / 导出、恢复默认、最终提示词预览

### 🤖 AI 分析
- **流式输出**，边生成边阅读
- **分阶段分析**：原局 → 人生领域 → 十二大限 → 前八大限 80 个流年 → 综合总结
- 每阶段独立请求、可单独重试、已完成阶段不重复消耗 Token
- Token 超限 / 输出截断自动拆分续写
- 实时持久化，刷新页面后可继续上次进度

### 📄 报告
- Markdown 渲染、目录导航、一键复制、下载 Markdown
- 正式 **A4 PDF 导出**（封面、基本信息、十二宫图、正文、免责声明、页码）

### 🗂 历史记录
- 基于 IndexedDB 本地存储（charts / reports / tasks）
- 查看、继续分析、重新生成、修改信息重排、下载、删除
- 全量导入 / 导出

### 🎨 外观
- 浅色 / 深色 / 跟随系统主题
- 字体大小、报告阅读宽度可调
- 四种命盘配色主题

## 🚀 快速开始

环境要求：Node.js ≥ 18

```bash
# 克隆项目
git clone https://github.com/ns2250225/ziwei.git
cd ziwei

# 安装依赖
npm install

# 启动开发模式
npm run dev

# 类型检查 + 生产构建（产物在 dist/）
npm run build

# 预览构建产物
npm run preview
```

## 📦 部署

`dist/` 为纯静态文件（Hash 路由、相对路径），可部署到任意静态托管服务：

- GitHub Pages / Vercel / Netlify / Cloudflare Pages
- Nginx / Caddy 等任意 Web 服务器

无需 Node 环境或任何后端服务。

## 🛠 技术栈

| 类别 | 技术 |
| --- | --- |
| 框架 | Vue 3（Composition API）+ TypeScript |
| 构建 | Vite |
| 状态管理 | Pinia |
| 路由 | Vue Router（Hash 模式） |
| UI 组件库 | Naive UI + Lucide Icons |
| 排盘引擎 | [iztro](https://github.com/SylarLong/iztro) + lunar-lite |
| 数据存储 | IndexedDB（[idb](https://github.com/jakearchibald/idb)） |
| Markdown | markdown-it + highlight.js |
| PDF 导出 | html2pdf.js |

## 📂 目录结构

```
src/
├── components/
│   ├── Chart/       命盘、宫位卡片、宫位详情、大限流年面板
│   ├── Report/      报告阅读、目录、进度
│   ├── Settings/    API、提示词、外观与数据
│   └── Common/      顶部导航、出生信息表单、Markdown 编辑器、API 状态
├── views/           Home / Chart / Analysis / History / Settings
├── services/        iztro 适配、命盘标准化、AI 客户端、提示词拼接、分阶段分析、PDF
├── stores/          chart / report / settings（Pinia）
├── router/          路由配置
├── database/        IndexedDB 封装
├── prompts/         默认模板与各阶段指令
├── utils/           工具函数
└── types/           类型定义
```

## 🔒 安全与隐私

- **API Key** 保存在 localStorage，与命盘、报告分开存储，不写入报告、导出文件或分享链接；界面默认掩码显示。
- **出生信息**仅在主动发起 AI 分析时发送给你自己配置的模型服务。
- 浏览器直连要求模型服务开放 CORS，否则需使用兼容代理。

## ⚠️ 免责声明

本工具仅供传统文化研究和娱乐参考，不构成医疗、投资、婚姻、法律等专业建议。

## 📄 许可证

[MIT](LICENSE)
