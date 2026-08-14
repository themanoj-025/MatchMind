import { Loader2 } from 'lucide-react'

export const GlobalSpinner = () => {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950">
      <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
    </div>
  )
}
