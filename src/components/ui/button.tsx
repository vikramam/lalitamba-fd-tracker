import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-[14px] font-semibold transition-transform disabled:pointer-events-none focus-visible:outline-none',
  {
    variants: {
      variant: {
        default: 'brand-gradient rounded-[13px]',
        outline:
          'rounded-[13px] border border-line bg-surface text-ink hover:bg-inner',
        ghost: 'rounded-[13px] text-accent hover:bg-surface',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-3 text-[13px]',
        lg: 'h-12 w-full px-5',
        icon: 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(
        buttonVariants({ variant, size, className }),
        props.disabled &&
          'bg-none shadow-none border border-line bg-[var(--border)] text-[color:var(--text-tertiary)]',
      )}
      {...props}
    />
  )
}

export { Button, buttonVariants }
