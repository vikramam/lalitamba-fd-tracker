import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

import { AppDialog } from '@/components/AppDialog'

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

type DialogState =
  | {
      kind: 'alert'
      title: string
      message: string
    }
  | {
      kind: 'confirm'
      title: string
      message: string
      confirmLabel: string
      cancelLabel: string
      tone: 'default' | 'danger'
    }

type DialogApi = {
  alert: (title: string, message: string) => Promise<void>
  confirm: (options: ConfirmOptions) => Promise<boolean>
  alertError: (cause: unknown, fallback: string, title?: string) => Promise<void>
}

const DialogContext = createContext<DialogApi | null>(null)

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const finish = useCallback((value: boolean) => {
    resolveRef.current?.(value)
    resolveRef.current = null
    setDialog(null)
  }, [])

  const alert = useCallback((title: string, message: string) => {
    return new Promise<void>((resolve) => {
      resolveRef.current?.(false)
      resolveRef.current = () => resolve()
      setDialog({ kind: 'alert', title, message })
    })
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current?.(false)
      resolveRef.current = resolve
      setDialog({
        kind: 'confirm',
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'OK',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        tone: options.tone ?? 'default',
      })
    })
  }, [])

  const alertError = useCallback(
    (cause: unknown, fallback: string, title = 'Something went wrong') => {
      return alert(title, cause instanceof Error ? cause.message : fallback)
    },
    [alert],
  )

  const value = useMemo(() => ({ alert, confirm, alertError }), [alert, confirm, alertError])

  return (
    <DialogContext.Provider value={value}>
      {children}
      <AppDialog
        open={Boolean(dialog)}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        confirmLabel={dialog?.kind === 'confirm' ? dialog.confirmLabel : 'OK'}
        cancelLabel={dialog?.kind === 'confirm' ? dialog.cancelLabel : undefined}
        tone={dialog?.kind === 'confirm' ? dialog.tone : 'default'}
        onConfirm={() => finish(true)}
        onClose={() => finish(false)}
      />
    </DialogContext.Provider>
  )
}

export function useDialog() {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('useDialog must be used within DialogProvider')
  }
  return context
}
