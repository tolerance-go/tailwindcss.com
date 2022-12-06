const path = require('path')
const { createLoader } = require('simple-functional-loader')
const frontMatter = require('front-matter')
const withSmartQuotes = require('@silvenon/remark-smartypants')
const { withTableOfContents } = require('./remark/withTableOfContents')
const { withSyntaxHighlighting } = require('./remark/withSyntaxHighlighting')
const { withNextLinks } = require('./remark/withNextLinks')
const { withLinkRoles } = require('./rehype/withLinkRoles')
const minimatch = require('minimatch')
const withExamples = require('./remark/withExamples')
const {
  highlightCode,
  fixSelectorEscapeTokens,
  simplifyToken,
  normalizeTokens,
} = require('./remark/utils')
const { withPrevalInstructions } = require('./remark/withPrevalInstructions')
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
const defaultConfig = require('tailwindcss/resolveConfig')(require('tailwindcss/defaultConfig'))
const Prism = require('prismjs')
const { getUtilities } = require('./utils')

const fallbackLayouts = {
  'src/pages/docs/**/*': ['@/layouts/DocumentationLayout', 'DocumentationLayout'],
}

const fallbackDefaultExports = {
  'src/pages/{docs,components}/**/*': ['@/layouts/ContentsLayout', 'ContentsLayout'],
  'src/pages/blog/**/*': ['@/layouts/BlogPostLayout', 'BlogPostLayout'],
  'src/pages/showcase/**/*': ['@/layouts/ShowcaseLayout', 'ShowcaseLayout'],
}

const fallbackGetStaticProps = {
  'src/pages/blog/**/*': '@/layouts/BlogPostLayout',
}

module.exports = withBundleAnalyzer({
  swcMinify: true,
  pageExtensions: ['js', 'jsx', 'mdx'],
  experimental: {
    esmExternals: false,
  },
  async redirects() {
    return require('./redirects.json')
  },
  webpack(config, options) {
    config.module.rules.push({
      test: /\.mp4$/i,
      issuer: /\.(jsx?|tsx?|mdx)$/,
      use: [
        {
          loader: 'file-loader',
          options: {
            publicPath: '/_next',
            name: 'static/media/[name].[hash].[ext]',
          },
        },
      ],
    })

    config.resolve.alias['defaultConfig$'] = require.resolve('tailwindcss/defaultConfig')
    config.module.rules.push({
      test: require.resolve('tailwindcss/defaultConfig'),
      use: createLoader(function (_source) {
        return `export default ${JSON.stringify(defaultConfig)}`
      }),
    })

    config.resolve.alias['utilities$'] = require.resolve('tailwindcss/lib/corePlugins.js')

    // import utilities from 'utilities?plugin=backgroundColor'
    config.module.rules.push({
      resourceQuery: /plugin/,
      test: require.resolve('tailwindcss/lib/corePlugins.js'),
      use: createLoader(function (_source) {
        let pluginName = new URLSearchParams(this.resourceQuery).get('plugin')
        let plugin = require('tailwindcss/lib/corePlugins.js').corePlugins[pluginName]
        return `export default ${JSON.stringify(getUtilities(plugin))}`
      }),
    })

    config.module.rules.push({
      resourceQuery: /examples/,
      test: require.resolve('tailwindcss/lib/corePlugins.js'),
      use: createLoader(function (_source) {
        let plugins = require('tailwindcss/lib/corePlugins.js').corePlugins
        let examples = Object.entries(plugins).map(([name, plugin]) => {
          let utilities = getUtilities(plugin)
          return {
            plugin: name,
            example:
              Object.keys(utilities).length > 0
                ? Object.keys(utilities)
                    [Math.floor((Object.keys(utilities).length - 1) / 2)].split(/[>:]/)[0]
                    .trim()
                    .substr(1)
                    .replace(/\\/g, '')
                : undefined,
          }
        })
        return `export default ${JSON.stringify(examples)}`
      }),
    })

    config.module.rules.push({
      test: /\.svg$/,
      use: [
        { loader: '@svgr/webpack', options: { svgoConfig: { plugins: { removeViewBox: false } } } },
        {
          loader: 'file-loader',
          options: {
            publicPath: '/_next',
            name: 'static/media/[name].[hash].[ext]',
          },
        },
      ],
    })

    // Remove the 3px deadzone for drag gestures in Framer Motion
    config.module.rules.push({
      test: /node_modules\/framer-motion/,
      use: createLoader(function (source) {
        return source.replace(
          /var isDistancePastThreshold = .*?$/m,
          'var isDistancePastThreshold = true'
        )
      }),
    })

    config.module.rules.push({
      resourceQuery: /fields/,
      use: createLoader(function (source) {
        let fields = new URLSearchParams(this.resourceQuery).get('fields').split(',')
        return JSON.stringify(JSON.parse(source), (key, value) => {
          return ['', ...fields].includes(key) ? value : undefined
        })
      }),
    })

    config.module.rules.push({
      resourceQuery: /highlight/,
      use: [
        options.defaultLoaders.babel,
        createLoader(function (source) {
          let lang =
            new URLSearchParams(this.resourceQuery).get('highlight') ||
            this.resourcePath.split('.').pop()
          let isDiff = lang.startsWith('diff-')
          let prismLang = isDiff ? lang.substr(5) : lang
          let grammar = Prism.languages[isDiff ? 'diff' : prismLang]
          let tokens = Prism.tokenize(source, grammar, lang)

          if (lang === 'css') {
            fixSelectorEscapeTokens(tokens)
          }

          return `
            export const tokens = ${JSON.stringify(tokens.map(simplifyToken))}
            export const lines = ${JSON.stringify(normalizeTokens(tokens))}
            export const code = ${JSON.stringify(source)}
            export const highlightedCode = ${JSON.stringify(highlightCode(source, lang))}
          `
        }),
      ],
    })

    let mdx = (plugins = []) => [
      {
        loader: '@mdx-js/loader',
        options:
          plugins === null
            ? {}
            : {
                remarkPlugins: [
                  withPrevalInstructions,
                  withExamples,
                  withTableOfContents,
                  withSyntaxHighlighting,
                  withNextLinks,
                  withSmartQuotes,
                  ...plugins,
                ],
                rehypePlugins: [withLinkRoles],
              },
      },
      createLoader(function (source) {
        let pathSegments = this.resourcePath.split(path.sep)
        let slug =
          pathSegments[pathSegments.length - 1] === 'index.mdx'
            ? pathSegments[pathSegments.length - 2]
            : pathSegments[pathSegments.length - 1].replace(/\.mdx$/, '')
        return source + `\n\nexport const slug = '${slug}'`
      }),
    ]

    config.module.rules.push({
      test: { and: [/\.mdx$/, /snippets/] },
      resourceQuery: { not: [/rss/, /preview/] },
      use: [
        options.defaultLoaders.babel,
        {
          loader: '@mdx-js/loader',
          options: {
            remarkPlugins: [withSyntaxHighlighting],
          },
        },
      ],
    })

    config.module.rules.push({
      test: /\.mdx$/,
      resourceQuery: /rss/,
      use: [options.defaultLoaders.babel, ...mdx()],
    })

    config.module.rules.push({
      test: /\.mdx$/,
      resourceQuery: /preview/,
      use: [
        options.defaultLoaders.babel,
        createLoader(function (src) {
          const [preview] = src.split('<!--/excerpt-->')
          return preview.replace('<!--excerpt-->', '')
        }),
        ...mdx([
          () => (tree) => {
            let firstParagraphIndex = tree.children.findIndex((child) => child.type === 'paragraph')
            if (firstParagraphIndex > -1) {
              tree.children = tree.children.filter((child, index) => {
                if (child.type === 'import' || child.type === 'export') {
                  return true
                }
                return index <= firstParagraphIndex
              })
            }
          },
        ]),
      ],
    })

    function mainMdxLoader(plugins) {
      return [
        options.defaultLoaders.babel,
        createLoader(function (source) {
          if (source.includes('/*START_META*/')) {
            const [meta] = source.match(/\/\*START_META\*\/(.*?)\/\*END_META\*\//s)
            return 'export default ' + meta
          }
          return (
            source.replace(/export const/gs, 'const') + `\nMDXContent.layoutProps = layoutProps\n`
          )
        }),
        ...mdx(plugins),
        createLoader(function (source) {
          let fields = new URLSearchParams(this.resourceQuery.substr(1)).get('meta') ?? undefined
          let { attributes: meta, body } = frontMatter(source)
          if (fields) {
            for (let field in meta) {
              if (!fields.split(',').includes(field)) {
                delete meta[field]
              }
            }
          }

          let extra = []
          let resourcePath = path.relative(__dirname, this.resourcePath)

          if (!/^\s*export\s+(var|let|const)\s+Layout\s+=/m.test(source)) {
            for (let glob in fallbackLayouts) {
              if (minimatch(resourcePath, glob)) {
                extra.push(
                  `import { ${fallbackLayouts[glob][1]} as _Layout } from '${fallbackLayouts[glob][0]}'`,
                  'export const Layout = _Layout'
                )
                break
              }
            }
          }

          if (!/^\s*export\s+default\s+/m.test(source.replace(/```(.*?)```/gs, ''))) {
            for (let glob in fallbackDefaultExports) {
              if (minimatch(resourcePath, glob)) {
                extra.push(
                  `import { ${fallbackDefaultExports[glob][1]} as _Default } from '${fallbackDefaultExports[glob][0]}'`,
                  'export default _Default'
                )
                break
              }
            }
          }

          if (
            !/^\s*export\s+(async\s+)?function\s+getStaticProps\s+/m.test(
              source.replace(/```(.*?)```/gs, '')
            )
          ) {
            for (let glob in fallbackGetStaticProps) {
              if (minimatch(resourcePath, glob)) {
                extra.push(`export { getStaticProps } from '${fallbackGetStaticProps[glob]}'`)
                break
              }
            }
          }

          let metaExport
          if (!/export\s+(const|let|var)\s+meta\s*=/.test(source)) {
            metaExport =
              typeof fields === 'undefined'
                ? `export const meta = ${JSON.stringify(meta)}`
                : `export const meta = /*START_META*/${JSON.stringify(meta || {})}/*END_META*/`
          }

          return [
            ...(typeof fields === 'undefined' ? extra : []),
            typeof fields === 'undefined'
              ? body.replace(/<!--excerpt-->.*<!--\/excerpt-->/s, '')
              : '',
            metaExport,
          ]
            .filter(Boolean)
            .join('\n\n')
        }),
      ]
    }

    config.module.rules.push({
      test: { and: [/\.mdx$/], not: [/snippets/] },
      resourceQuery: { not: [/rss/, /preview/] },
      exclude: [path.join(__dirname, 'src/pages/showcase/')],
      use: mainMdxLoader(),
    })

    config.module.rules.push({
      test: /\.mdx$/,
      include: [path.join(__dirname, 'src/pages/showcase/')],
      use: mainMdxLoader(null),
    })

    return config
  },
})
