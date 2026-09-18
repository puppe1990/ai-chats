import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(__dirname, 'styles.css'), 'utf8')

function bodyRule(): string {
  const match = css.match(/\nbody \{[^}]*\}/)
  if (!match) throw new Error('body rule not found in styles.css')
  return match[0]
}

describe('styles.css body overflow', () => {
  it('uses overflow-x: clip so position: sticky works in WebKit', () => {
    const body = bodyRule()

    expect(body).toContain('overflow-x: clip')
    // overflow-y: auto/scroll/hidden on body creates a scroll container in
    // WebKit and silently disables position: sticky for all descendants.
    expect(body).not.toMatch(/overflow-y:\s*(auto|scroll|hidden)/)
  })
})
