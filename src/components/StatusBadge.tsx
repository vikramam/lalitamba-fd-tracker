import { cn } from '@/lib/utils'

const TONES = {
  success: 'bg-[rgba(95,177,88,0.14)] text-success',
  warn: 'bg-[rgba(217,130,43,0.14)] text-warn',
  danger: 'bg-[rgba(229,86,74,0.14)] text-danger',
  muted: 'bg-[rgba(161,161,170,0.14)] text-muted',
}

export function StatusBadge({
  tone = 'muted',
  children,
}: {
  tone?: keyof typeof TONES
  children: string
}) {
  return (
    <span
      className={cn(
        'type-micro inline-flex rounded-full px-2 py-0.5 font-bold tracking-[0.06em] uppercase',
        TONES[tone],
      )}
    >
      {children}
    </span>
  )
}
