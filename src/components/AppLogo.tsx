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
      src="/updated_logo_2.jpeg"
      alt={alt}
      className={cn('rounded-full object-cover', className)}
    />
  )
}
