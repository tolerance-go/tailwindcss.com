import { Plugin } from 'tailwindcss/corePlugins'

export type Selector = string
export type CSSProperty = string
export type CSSValue = string
export type CSSProperties = Record<CSSProperty, CSSValue>

declare const getUtilities: (
  plugin: Plugin,
  options?: {
    includeNegativeValues: boolean
  }
  /**
   * {
      'bg-bottom': { 'background-position': 'bottom' },
      'bg-center': { 'background-position': 'center' },
      'bg-left': { 'background-position': 'left' },
      'bg-left-bottom': { 'background-position': 'left bottom' },
      'bg-left-top': { 'background-position': 'left top' },
      'bg-right': { 'background-position': 'right' },
      'bg-right-bottom': { 'background-position': 'right bottom' },
      'bg-right-top': { 'background-position': 'right top' },
      'bg-top': { 'background-position': 'top' },
    },
  */
) => Record<Selector, CSSProperties>

export { getUtilities }
