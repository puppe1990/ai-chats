import { describe, expect, it } from 'vitest'
import { uniqueFolderLabels } from './chat-folders'

describe('uniqueFolderLabels', () => {
  it('uses the last path segment when it is unique', () => {
    const labels = uniqueFolderLabels(['/Users/test/project', '/Users/test/other'])

    expect(labels.get('/Users/test/project')).toBe('project')
    expect(labels.get('/Users/test/other')).toBe('other')
  })

  it('extends clashing names with the shortest unique parent suffix', () => {
    const labels = uniqueFolderLabels([
      '/Users/test/dev/app',
      '/Users/test/work/app',
      '/Users/test/work/app/nested',
    ])

    expect(labels.get('/Users/test/dev/app')).toBe('dev/app')
    expect(labels.get('/Users/test/work/app')).toBe('work/app')
    expect(labels.get('/Users/test/work/app/nested')).toBe('nested')
  })

  it('keeps the root path as its own label', () => {
    expect(uniqueFolderLabels(['/']).get('/')).toBe('/')
  })

  it('returns one label per path', () => {
    const labels = uniqueFolderLabels(['/a/one', '/b/two'])
    expect(labels.size).toBe(2)
  })
})
