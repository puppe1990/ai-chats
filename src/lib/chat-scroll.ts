export const SCROLL_BOTTOM_THRESHOLD = 80

export interface ScrollMetrics {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

export function getScrollMetrics(): ScrollMetrics {
  const root = document.documentElement
  return {
    scrollTop: window.scrollY ?? root.scrollTop,
    scrollHeight: root.scrollHeight,
    clientHeight: root.clientHeight,
  }
}

export function isNearBottom(
  metrics: ScrollMetrics,
  threshold = SCROLL_BOTTOM_THRESHOLD,
): boolean {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <= threshold
}

export function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
  const root = document.documentElement
  window.scrollTo({ top: root.scrollHeight, behavior })
}
