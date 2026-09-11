import { useState } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { SheetPicker } from '@/components/SheetPicker'
import { CheckIcon, FamilyIcon } from '@/components/icons'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { ALL_FAMILIES_SCOPE } from '@/lib/household-scope'
import { cn } from '@/lib/utils'

function useFamilyOptions() {
  const { canSwitchFamily, allFamilies, allHousehold, familyScope, setFamilyScope } =
    useHousehold()
  const selected =
    familyScope === ALL_FAMILIES_SCOPE
      ? null
      : allFamilies.find((family) => family.id === familyScope)
  const homeIds = new Set(allHousehold?.membershipFamilyIds ?? [])
  const options = [
    {
      id: ALL_FAMILIES_SCOPE,
      label: 'All families',
      secondary: 'Every family you can access',
    },
    ...allFamilies.map((family) => ({
      id: family.id,
      label: family.name,
      secondary: homeIds.has(family.id) ? 'Your family' : undefined,
    })),
  ]
  return {
    canSwitchFamily,
    familyScope,
    setFamilyScope,
    valueLabel: selected?.name ?? 'All families',
    options,
  }
}

export function FamilySwitcher({
  className,
  variant = 'sheet',
}: {
  className?: string
  variant?: 'sheet' | 'tab'
}) {
  const { canSwitchFamily, familyScope, setFamilyScope, valueLabel, options } =
    useFamilyOptions()
  const [open, setOpen] = useState(false)
  if (!canSwitchFamily) return null

  if (variant === 'tab') {
    return (
      <>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className={cn(
            'relative flex flex-col items-center gap-1 py-2.5 text-[12px] font-medium leading-tight',
            open ? 'text-accent' : 'text-muted',
          )}
        >
          <FamilyIcon className="size-[22px]" />
          Family
          {open ? (
            <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-accent" />
          ) : null}
        </button>
        <BottomSheet open={open} onClose={() => setOpen(false)} title="Family">
          <ul className="space-y-1 pt-1">
            {options.map((option) => {
              const selected = familyScope === option.id
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setFamilyScope(option.id)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left',
                      selected ? 'bg-inner' : 'hover:bg-inner',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="type-card-title block truncate text-ink">
                        {option.label}
                      </span>
                      {option.secondary ? (
                        <span className="type-small mt-0.5 block truncate">
                          {option.secondary}
                        </span>
                      ) : null}
                    </span>
                    {selected ? (
                      <CheckIcon className="size-4 shrink-0 text-accent" />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </BottomSheet>
      </>
    )
  }

  return (
    <div className={cn(className)}>
      <SheetPicker
        title="Family"
        hint="Applies across the app"
        valueLabel={valueLabel}
        selectedId={familyScope}
        onSelect={setFamilyScope}
        options={options}
      />
    </div>
  )
}
