import { useEffect, type RefObject } from 'react'

export const HEADER_HEIGHT_VAR = '--app-header-h'

/**
 * Publishes the measured height of `ref` as `--app-header-h` on <html>.
 * Usage: const ref = useRef(null); useHeaderHeightVar(ref); <header ref={ref} />
 */
export function useHeaderHeightVar(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return

    const root = document.documentElement
    const publish = () => {
      root.style.setProperty(
        HEADER_HEIGHT_VAR,
        `${element.getBoundingClientRect().height}px`,
      )
    }

    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
}
