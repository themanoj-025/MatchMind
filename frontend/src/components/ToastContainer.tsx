import { useToastStore } from '../store/useToastStore'

export const ToastContainer = () => {
  const { toasts } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-5 py-3 rounded-lg shadow-xl backdrop-blur-md border border-white/10 text-sm font-medium transition-all duration-300 animate-fade-in pointer-events-auto ${
            toast.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300'
              : toast.type === 'error'
              ? 'bg-rose-500/20 text-rose-300'
              : 'bg-indigo-500/20 text-indigo-300'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
