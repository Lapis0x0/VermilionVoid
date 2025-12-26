import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import sitemap from "@astrojs/sitemap"
import swup from "@swup/astro"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypeComponents from "rehype-components"
import rehypeKatex from "rehype-katex"
import rehypeSlug from "rehype-slug"
import remarkDirective from "remark-directive"
import remarkGithubAdmonitionsToDirectives from "remark-github-admonitions-to-directives"
import remarkMath from "remark-math"
import remarkSectionize from "remark-sectionize"
import { AdmonitionComponent } from "./src/plugins/rehype-component-admonition.mjs"
import { GithubCardComponent } from "./src/plugins/rehype-component-github-card.mjs"
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.js"
import { remarkExcerpt } from "./src/plugins/remark-excerpt.js"
import { remarkReadingTime } from "./src/plugins/remark-reading-time.mjs"

const createAdmonitionComponent = (type) => (properties = {}, children = []) => {
  const normalizedChildren = Array.isArray(children) ? children : []
  return AdmonitionComponent(properties, normalizedChildren, type)
}

export default defineConfig({
  srcDir: "./src",
  output: "static",
  site: "https://www.lapis.cafe",
  trailingSlash: "always",
  alias: {
    "@": "./src",
  },
  integrations: [
    react(),
    swup({
      theme: false,
      animationClass: "transition-swup-",
      containers: ["#swup-container"],
      smoothScrolling: true,
      cache: true,
      preload: true,
      accessibility: true,
      updateHead: true,
      updateBodyClass: false,
      globalInstance: true,
    }),
    sitemap(),
  ],
  markdown: {
    remarkPlugins: [
      remarkMath,
      remarkReadingTime,
      remarkExcerpt,
      remarkGithubAdmonitionsToDirectives,
      remarkDirective,
      remarkSectionize,
      parseDirectiveNode,
    ],
    rehypePlugins: [
      rehypeKatex,
      rehypeSlug,
      [
        rehypeComponents,
        {
          components: {
            github: GithubCardComponent,
            note: createAdmonitionComponent("note"),
            tip: createAdmonitionComponent("tip"),
            important: createAdmonitionComponent("important"),
            caution: createAdmonitionComponent("caution"),
            warning: createAdmonitionComponent("warning"),
          },
        },
      ],
      [
        rehypeAutolinkHeadings,
        {
          behavior: "append",
          properties: {
            className: ["anchor"],
          },
          content: {
            type: "element",
            tagName: "span",
            properties: {
              className: ["anchor-icon"],
              "data-pagefind-ignore": true,
            },
            children: [
              {
                type: "text",
                value: "#",
              },
            ],
          },
        },
      ],
    ],
  },
})
