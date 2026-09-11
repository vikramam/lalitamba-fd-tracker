import type { SVGProps } from 'react'

import { cn } from '@/lib/utils'

type IconProps = SVGProps<SVGSVGElement> & { className?: string }

function Icon({ className, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5', className)}
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </Icon>
  )
}

export function FamilyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 10.5 12 3.5l9 7V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <circle cx="12" cy="12.5" r="2" />
      <path d="M8.5 19.5a3.5 3.5 0 0 1 7 0" />
    </Icon>
  )
}

export function PeopleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16 19a4.6 4.6 0 0 1 5-4.4" />
    </Icon>
  )
}

export function LedgerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4.5" />
    </Icon>
  )
}

export function GearIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3V20.5M4.8 7.2l1.6 1.6M17.6 15.2l1.6 1.6M3.5 12h2.2M18.3 12H20.5M4.8 16.8l1.6-1.6M17.6 8.8l1.6-1.6" />
    </Icon>
  )
}

export function ChevronIcon(props: IconProps) {
  return (
    <Icon className={cn('size-4', props.className)} {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  )
}

export function GroupsOpenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" />
      <path d="M8 12h8" />
    </Icon>
  )
}

export function GroupsClosedIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </Icon>
  )
}

export function CameraIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 8.5h2.2l1.2-2h8.2l1.2 2H19.5A1.5 1.5 0 0 1 21 10v8.5A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5V10a1.5 1.5 0 0 1 1.5-1.5z" />
      <circle cx="12" cy="14" r="3.2" />
    </Icon>
  )
}

export function PhotoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="m3.8 16.5 4.6-4.2 3.2 2.8 3.4-3.6 5.2 5" />
    </Icon>
  )
}

export function SpinnerIcon({ className, ...props }: IconProps) {
  return (
    <Icon className={cn('animate-spin', className)} {...props}>
      <circle cx="12" cy="12" r="8.5" opacity="0.25" />
      <path d="M20.5 12a8.5 8.5 0 0 0-8.5-8.5" />
    </Icon>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5 9.5 17 19 7.5" />
    </Icon>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0 0-3L17.5 3.5a2.1 2.1 0 0 0-3 0L3 15v5z" />
      <path d="m13.5 4.5 5 5" />
    </Icon>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 7h14" />
      <path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="M8 7l.6 12.2A1.5 1.5 0 0 0 10.1 20.5h3.8a1.5 1.5 0 0 0 1.5-1.3L16 7" />
      <path d="M10 11v6M14 11v6" />
    </Icon>
  )
}

export function RenewIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12a8 8 0 1 1-2.2-5.5" />
      <path d="M20 4v5h-5" />
    </Icon>
  )
}

export function StopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 9h6v6H9z" />
    </Icon>
  )
}

export function ShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v11" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 13v6.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V13" />
    </Icon>
  )
}

