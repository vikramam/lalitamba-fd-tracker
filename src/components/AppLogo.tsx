import { cn } from '@/lib/utils'

export function AppLogo({
  className,
  alt = 'Lalitamba FD',
}: {
  className?: string
  alt?: string
}) {
  return (
    <img
      src="/pwa-icon-192.png"
      alt={alt}
      className={cn('rounded-2xl object-cover', className)}
    />
  )
}
