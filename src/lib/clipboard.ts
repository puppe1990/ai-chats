/** Copy text to the system clipboard (works in browser + Tauri webview). */
export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // fall through — Tauri / insecure contexts may reject clipboard API
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!ok) {
    throw new Error('Failed to copy to clipboard')
  }
}
