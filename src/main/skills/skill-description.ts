interface FrontmatterInfo {
  name?: string
  description?: string
}

export interface SkillDescriptionResult {
  readonly description: string
  readonly source: 'frontmatter' | 'body' | 'none'
}

const PREVIEW_MAX = 160

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

const truncatePreview = (value: string, max = PREVIEW_MAX): string => {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

const parseSkillFrontmatter = (content: string): FrontmatterInfo => {
  const match = /^---\s*\n([\s\S]*?)\n---\s*/.exec(content)
  if (!match) return {}
  const body = match[1] ?? ''
  const out: FrontmatterInfo = {}

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
    if (key === 'name') out.name = value
    if (key === 'description') out.description = value
  }

  return out
}

const stripFrontmatter = (content: string): string =>
  content.replace(/^---\s*\n[\s\S]*?\n---\s*/m, '')

const firstMeaningfulBodyParagraph = (content: string): string | null => {
  const body = stripFrontmatter(content).replace(/\r\n/g, '\n')
  const lines = body.split('\n')

  const paragraphs: string[] = []
  const current: string[] = []
  let inCodeFence = false

  const flush = () => {
    const normalized = normalizeWhitespace(current.join(' '))
    if (normalized) paragraphs.push(normalized)
    current.length = 0
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('```')) {
      inCodeFence = !inCodeFence
      continue
    }
    if (inCodeFence) continue

    if (!line) {
      flush()
      continue
    }

    if (
      /^#{1,6}\s/.test(line) ||
      /^[-*+]\s/.test(line) ||
      /^\d+\.\s/.test(line) ||
      /^>\s?/.test(line)
    ) {
      flush()
      continue
    }

    current.push(line)
  }
  flush()

  return paragraphs[0] ?? null
}

export const extractSkillDescription = (
  content: string,
  max = PREVIEW_MAX,
): SkillDescriptionResult => {
  const frontmatter = normalizeWhitespace(parseSkillFrontmatter(content).description ?? '')
  if (frontmatter) {
    return {
      description: truncatePreview(frontmatter, max),
      source: 'frontmatter',
    }
  }

  const body = firstMeaningfulBodyParagraph(content)
  if (body) {
    return {
      description: truncatePreview(body, max),
      source: 'body',
    }
  }

  return {
    description: '',
    source: 'none',
  }
}
