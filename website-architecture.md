# DeepDiagram 官网架构方案

> 基于 Next.js 全新构建，以 SEO 为核心目标的官方网站。

---

## 1. 技术选型

| 类别 | 选型 | 说明 |
|------|------|------|
| 框架 | Next.js 15 (App Router) | SSG 为主，SEO 友好 |
| 语言 | TypeScript | 类型安全 |
| 样式 | Tailwind CSS 4 | 原子化 CSS，零运行时 |
| 内容 | MDX + gray-matter | Markdown 写作 + React 组件嵌入 |
| i18n | next-intl | App Router i18n 方案 |
| 动画 | CSS Animation 为主 | 减少 JS 体积，仅少量交互用 Framer Motion |
| 图标 | Lucide React | 按需引入 |
| 字体 | next/font (Inter + Noto Sans SC) | 自托管，无外部请求 |
| 代码高亮 | Shiki + rehype-pretty-code | 构建时高亮，零运行时 JS |
| 部署 | Docker standalone + Nginx | 与现有架构一致 |

---

## 2. SEO 与重定向策略（重点）

### 2.1 根路径重定向问题

**现有问题：**
- `src/app/page.tsx` 使用 `redirect('/zh')`，Next.js 默认 **307 临时重定向**
- `next-intl` 中间件根据 `Accept-Language` 动态决定重定向目标
- Google 爬虫默认发送 `Accept-Language: en`，会被引导到 `/en`
- 307 不传递 SEO 权重，Google 视为临时状态，不利于索引

**新方案：**

```
https://cturing.cn/          →  301 到 /en （永久重定向，面向国际用户 & Google 爬虫）
https://cturing.cn/en/       →  直接返回 200，英文首页
https://cturing.cn/zh/       →  直接返回 200，中文首页
```

**实现方式：**

```typescript
// src/app/page.tsx
import { permanentRedirect } from 'next/navigation';

export default function RootPage() {
  permanentRedirect('/en');  // 301 永久重定向
}
```

```typescript
// src/lib/i18n/routing.ts
export const routing = defineRouting({
  locales: ['en', 'zh'],
  defaultLocale: 'en',           // 默认英文（面向 Google 爬虫）
  localePrefix: 'always',        // URL 始终带 locale 前缀
  localeDetection: false,        // 禁用 Accept-Language 自动检测，行为确定性
});
```

**关键配置：`localeDetection: false`**
- 禁止 next-intl 根据浏览器语言自动重定向
- 确保 `/` 始终 301 到 `/en`，行为对爬虫完全确定
- 用户通过页面上的语言切换器手动选择语言

### 2.2 默认语言选择

建议默认 `en`（英文）的原因：
- Google 爬虫默认以英文抓取
- 国际用户占比（GitHub 开源项目面向全球）
- `/en` 作为 SEO 主力语言，权重最高
- 中文用户可通过语言切换器切换到 `/zh`

> 如果你希望默认中文，改 `defaultLocale: 'zh'` + `permanentRedirect('/zh')` 即可。

### 2.3 hreflang 标签

每个页面 `<head>` 中输出：

```html
<link rel="alternate" hreflang="en" href="https://cturing.cn/en/features" />
<link rel="alternate" hreflang="zh" href="https://cturing.cn/zh/features" />
<link rel="alternate" hreflang="x-default" href="https://cturing.cn/en/features" />
```

- `x-default` 指向 `/en` 版本（与默认重定向一致）
- Google 据此理解多语言页面关系，不会视为重复内容

### 2.4 Canonical URL

```html
<!-- /en/features 页面 -->
<link rel="canonical" href="https://cturing.cn/en/features" />

<!-- /zh/features 页面 -->
<link rel="canonical" href="https://cturing.cn/zh/features" />
```

每个语言版本都有独立的 canonical，互不干扰。

### 2.5 Sitemap

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/schemas/sitemap/0.9">
  <url>
    <loc>https://cturing.cn/en/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://cturing.cn/en/" />
    <xhtml:link rel="alternate" hreflang="zh" href="https://cturing.cn/zh/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://cturing.cn/en/" />
    <lastmod>2025-01-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://cturing.cn/zh/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://cturing.cn/en/" />
    <xhtml:link rel="alternate" hreflang="zh" href="https://cturing.cn/zh/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://cturing.cn/en/" />
    <lastmod>2025-01-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- 其他页面同理 -->
</urlset>
```

**关键：**
- 根路径 `/` 不出现在 sitemap 中（它只是 301 跳转）
- 每个 URL 都带完整的 hreflang 交叉引用
- `x-default` 始终指向 `/en` 版本
- 博客和文档也按语言分别列出

### 2.6 robots.txt

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /_next/

Sitemap: https://cturing.cn/sitemap.xml
```

### 2.7 结构化数据 (JSON-LD)

| 页面 | Schema 类型 |
|------|------------|
| 首页 | WebSite + Organization + SoftwareApplication |
| 功能页 | WebPage + SoftwareApplication.featureList |
| 定价页 | WebPage + Product + Offer |
| 博客文章 | BlogPosting + BreadcrumbList |
| 文档页 | TechArticle + BreadcrumbList |
| 关于页 | AboutPage + Organization |

### 2.8 Meta 标签

每个页面必须包含：
- `<title>` — 含品牌名，≤ 60 字符
- `<meta name="description">` — ≤ 160 字符
- Open Graph（og:title, og:description, og:image, og:url, og:type）
- Twitter Card（summary_large_image）

### 2.9 渲染策略

```
所有页面 → SSG（构建时静态生成）
OG 图片 → Edge Runtime 按需生成
```

不使用 SSR，确保爬虫抓取到的是完整 HTML。

### 2.10 Core Web Vitals 目标

| 指标 | 目标 | 措施 |
|------|------|------|
| LCP | < 2.5s | 首屏图片 `priority` 预加载，字体 `display: swap` |
| INP | < 200ms | 减少 Client Component，动画用 CSS |
| CLS | < 0.1 | 图片固定宽高比，字体预加载 |

---

## 3. 项目结构

```
website/
├── public/
│   ├── images/
│   │   ├── hero/            # 首页主视觉
│   │   ├── features/        # 功能截图
│   │   └── og/              # 默认 OG 图片
│   ├── logo.svg
│   └── favicon.ico
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # 根 layout（html/body，最小化）
│   │   ├── page.tsx                      # 301 permanentRedirect → /en
│   │   ├── not-found.tsx
│   │   ├── robots.ts
│   │   ├── sitemap.ts                    # 含 hreflang 的 sitemap
│   │   │
│   │   ├── [locale]/
│   │   │   ├── layout.tsx                # i18n layout（Header + Footer）
│   │   │   ├── page.tsx                  # 首页
│   │   │   ├── features/page.tsx
│   │   │   ├── pricing/page.tsx
│   │   │   ├── about/page.tsx
│   │   │   ├── blog/
│   │   │   │   ├── page.tsx              # 博客列表
│   │   │   │   └── [slug]/page.tsx       # 博客详情（SSG）
│   │   │   ├── docs/
│   │   │   │   ├── layout.tsx            # 文档 layout（侧边栏）
│   │   │   │   ├── page.tsx              # 文档首页
│   │   │   │   └── [slug]/page.tsx       # 文档详情（SSG）
│   │   │   └── changelog/page.tsx
│   │   │
│   │   └── api/og/route.tsx              # OG 图片生成（Edge）
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx                # Server Component
│   │   │   ├── MobileNav.tsx             # Client（toggle 交互）
│   │   │   ├── Footer.tsx                # Server Component
│   │   │   └── LocaleSwitcher.tsx        # Client（路由切换）
│   │   ├── home/
│   │   │   ├── Hero.tsx                  # Server（CSS 动画）
│   │   │   ├── FeatureGrid.tsx           # Server
│   │   │   ├── HowItWorks.tsx            # Server
│   │   │   ├── DemoShowcase.tsx          # Client（Tab 切换）
│   │   │   ├── OpenSource.tsx            # Server
│   │   │   └── CTASection.tsx            # Server
│   │   ├── blog/
│   │   │   ├── BlogCard.tsx              # Server
│   │   │   └── BlogContent.tsx           # Server（MDX 渲染）
│   │   ├── docs/
│   │   │   ├── DocsSidebar.tsx           # Server
│   │   │   ├── DocsContent.tsx           # Server
│   │   │   └── TableOfContents.tsx       # Client（滚动监听）
│   │   ├── seo/
│   │   │   └── JsonLd.tsx               # Server
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Badge.tsx
│   │       ├── Container.tsx
│   │       ├── Section.tsx
│   │       └── Card.tsx
│   │
│   ├── content/
│   │   ├── blog/
│   │   │   ├── en/                       # 英文博客 MDX
│   │   │   └── zh/                       # 中文博客 MDX
│   │   └── docs/
│   │       ├── en/                       # 英文文档 MDX
│   │       └── zh/                       # 中文文档 MDX
│   │
│   ├── lib/
│   │   ├── i18n/
│   │   │   ├── config.ts                # locales + defaultLocale
│   │   │   ├── routing.ts               # defineRouting（localeDetection: false）
│   │   │   ├── request.ts
│   │   │   └── navigation.ts
│   │   ├── mdx/
│   │   │   ├── content.ts               # MDX 读取/解析
│   │   │   ├── components.tsx           # MDX 自定义组件
│   │   │   └── types.ts                 # Frontmatter 类型
│   │   ├── seo/
│   │   │   ├── metadata.ts              # createMetadata（含 hreflang + x-default）
│   │   │   └── jsonld.ts
│   │   └── utils.ts
│   │
│   ├── messages/
│   │   ├── en.json
│   │   └── zh.json
│   │
│   ├── styles/
│   │   └── globals.css
│   │
│   └── middleware.ts                    # next-intl middleware
│
├── next.config.ts
├── tsconfig.json
├── Dockerfile
└── package.json
```

---

## 4. 页面规划

### 4.1 首页 `/[locale]/`

```
┌──────────────────────────────────────┐
│  Header（Logo + 导航 + 语言切换 + CTA） │
├──────────────────────────────────────┤
│  Hero                                │
│  标题 + 副标题 + 两个 CTA 按钮         │
│  下方: 产品截图/演示动图               │
├──────────────────────────────────────┤
│  FeatureGrid                         │
│  六大智能体，2×3 卡片网格              │
├──────────────────────────────────────┤
│  HowItWorks                          │
│  三步流程: 输入 → AI 生成 → 导出       │
├──────────────────────────────────────┤
│  DemoShowcase                        │
│  多 Tab 切换展示各类图表生成效果        │
├──────────────────────────────────────┤
│  OpenSource                          │
│  MIT + Docker + GitHub               │
├──────────────────────────────────────┤
│  CTA                                 │
├──────────────────────────────────────┤
│  Footer                              │
└──────────────────────────────────────┘
```

### 4.2 其他页面

| 路由 | 页面 | 说明 |
|------|------|------|
| `/[locale]/features` | 功能特性 | 六大智能体详细展示 + 截图 |
| `/[locale]/pricing` | 定价 | 开源版 vs 托管版对比 + FAQ |
| `/[locale]/about` | 关于 | 项目介绍 + 技术架构 |
| `/[locale]/blog` | 博客列表 | 卡片布局 |
| `/[locale]/blog/[slug]` | 博客详情 | MDX + 目录 + 阅读时间 |
| `/[locale]/docs` | 文档首页 | 卡片导航 |
| `/[locale]/docs/[slug]` | 文档详情 | 侧边栏 + 内容 + TOC |
| `/[locale]/changelog` | 更新日志 | 按版本倒序 |

---

## 5. Server / Client Component 划分

**原则：Client Component 控制在 4 个以内。**

| 组件 | 类型 | 原因 |
|------|------|------|
| Header | Server | 纯展示 |
| MobileNav | **Client** | toggle 交互 |
| LocaleSwitcher | **Client** | router.replace |
| Footer | Server | 纯展示 |
| Hero | Server | CSS 动画 |
| FeatureGrid | Server | 纯展示 |
| HowItWorks | Server | 纯展示 |
| DemoShowcase | **Client** | Tab 切换 |
| TableOfContents | **Client** | 滚动监听 |
| 其余所有组件 | Server | 纯展示 |

---

## 6. 内容管理

### 博客 Frontmatter

```yaml
---
title: "文章标题"
description: "SEO 描述 ≤160 字符"
date: "2025-01-15"
author: "作者名"
category: "announcements"   # announcements | technical | tutorial
tags: ["AI", "visualization"]
image: "/images/blog/xxx.png"
draft: false
---
```

### 文档 Frontmatter

```yaml
---
title: "文档标题"
description: "文档描述"
order: 1
---
```

### 更新日志

```typescript
// src/content/changelog.ts
export const changelog = [
  {
    version: "0.1.27",
    date: "2025-01-15",
    changes: {
      added: ["新增信息图智能体"],
      fixed: ["修复流程图导出问题"],
      improved: ["优化思维导图渲染性能"],
    },
  },
];
```

---

## 7. 部署

```
               Nginx (80/443)
               ┌─────────────────────┐
cturing.cn ────┤  → website:3000     │  Next.js standalone
               │                     │
deepd.cturing ─┤  → frontend:80     │  React SPA
 .cn           │  → backend:8000    │  FastAPI
               └─────────────────────┘
```

Docker Compose 中 website 服务不变，`output: 'standalone'`。

---

## 8. 依赖清单

```json
{
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-intl": "^4.0.0",
    "@next/mdx": "^15.1.0",
    "next-mdx-remote": "^5.0.0",
    "@mdx-js/react": "^3.1.0",
    "gray-matter": "^4.0.3",
    "reading-time": "^1.5.0",
    "rehype-slug": "^6.0.0",
    "rehype-autolink-headings": "^7.1.0",
    "rehype-pretty-code": "^0.14.0",
    "remark-gfm": "^4.0.1",
    "shiki": "^1.24.0",
    "lucide-react": "^0.469.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.0.0",
    "framer-motion": "^11.15.0"
  },
  "devDependencies": {
    "typescript": "~5.7.3",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.5.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/node": "^22.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.1.0"
  }
}
```

---

## 9. 与旧代码的关系

- **完全重写** `website/` 目录下的所有源码
- **保留** `website/src/content/` 下已有的 MDX 博客和文档内容
- **保留** `website/src/messages/` 下已有的 i18n 文案（在此基础上扩充）
- **不影响** frontend、backend、nginx、docker-compose 等其他目录

---

## 10. 实施步骤

1. 初始化项目，配置 Next.js + TypeScript + Tailwind
2. 搭建 i18n（next-intl + middleware + `localeDetection: false` + 301 重定向）
3. SEO 基础设施（metadata 工具函数 + JSON-LD + sitemap 含 hreflang + robots）
4. Layout 层（Header + Footer + LocaleSwitcher）
5. 首页各 Section
6. 功能页、定价页、关于页
7. 博客系统（MDX 解析 + 列表 + 详情）
8. 文档系统（MDX + 侧边栏 + TOC）
9. 更新日志页
10. OG 图片动态生成
11. Lighthouse 审计 + 性能优化
12. Docker 构建 + 部署验证
