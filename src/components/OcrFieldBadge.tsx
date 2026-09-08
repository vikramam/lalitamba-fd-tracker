import { StatusBadge } from '@/components/StatusBadge'
import type { OcrBadge } from '@/lib/ocr-reviews'

const COPY: Record<OcrBadge, { label: string; tone: 'success' | 'warn' | 'muted' }> = {
  from_receipt: { label: 'From receipt', tone: 'muted' },
  corrected: { label: 'Corrected', tone: 'success' },
  check_this: { label: 'Check this', tone: 'warn' },
}

export function OcrFieldBadge({ kind }: { kind?: OcrBadge | null }) {
  if (!kind) return null
  const copy = COPY[kind]
  return <StatusBadge tone={copy.tone}>{copy.label}</StatusBadge>
}
