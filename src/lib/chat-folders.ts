interface FolderEntry {
  path: string
  segments: string[]
}

function folderSegments(path: string): string[] {
  return path.split('/').filter(Boolean)
}

function uniqueTrailingLabel(entry: FolderEntry, all: FolderEntry[]): string {
  for (let depth = 1; depth <= entry.segments.length; depth++) {
    const suffix = entry.segments.slice(-depth).join('/')
    const clashes = all.some(
      (other) =>
        other.path !== entry.path && other.segments.slice(-depth).join('/') === suffix,
    )
    if (!clashes) return suffix
  }

  return entry.segments.join('/') || entry.path
}

/**
 * Shortest trailing-path label per folder that stays unique across `paths`.
 * "/Users/me/dev/app" and "/Users/me/work/app" become "dev/app" and "work/app".
 */
export function uniqueFolderLabels(paths: string[]): Map<string, string> {
  const entries: FolderEntry[] = paths.map((path) => ({
    path,
    segments: folderSegments(path),
  }))

  return new Map(
    entries.map((entry) => [entry.path, uniqueTrailingLabel(entry, entries)]),
  )
}
