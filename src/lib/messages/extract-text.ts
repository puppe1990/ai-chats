export function stripUserQueryTags(text: string): string {
  return text.replace(/<\/?user_query>/g, '').trim()
}

export function extractTextFromParts(
  parts: Array<{ type?: string; text?: string }>,
): string {
  const chunks: string[] = []
  for (const part of parts) {
    if (!part.text?.trim()) continue
    if (part.type === 'tool_use' || part.type === 'tool-result') continue
    if (
      part.type === 'text' ||
      part.type === 'input_text' ||
      part.type === 'output_text'
    ) {
      chunks.push(part.text.trim())
    }
  }
  return chunks.join('\n\n')
}
