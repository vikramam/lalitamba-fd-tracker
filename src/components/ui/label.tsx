import * as LabelPrimitive from '@radix-ui/react-label'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

function Label({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
