import { createContext, useContext } from 'react'

export type DismissDialog = (immediate?: boolean) => void
export const DialogContext = createContext<DismissDialog | null>(null)

export function useDismissDialog() {
  const dismiss = useContext(DialogContext)
  if (!dismiss) throw new Error('Dialog controls must be inside a Modal.')
  return dismiss
}
