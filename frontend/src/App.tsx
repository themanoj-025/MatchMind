import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { GlobalSpinner } from './components/GlobalSpinner'
import { ToastContainer } from './components/ToastContainer'
import { useAuthStore } from './store/useAuthStore'

// Lazy loaded views for code-splitting
const Landing = lazy(() => import('./views/Landing').then((m) => ({ default: m.Landing })))
const Auth = lazy(() => import('./views/Auth').then((m) => ({ default: m.Auth })))
const Lobby = lazy(() => import('./views/Lobby').then((m) => ({ default: m.Lobby })))
const DraftRoom = lazy(() => import('./views/DraftRoom').then((m) => ({ default: m.DraftRoom })))
const Leaderboard = lazy(() => import('./views/Leaderboard').then((m) => ({ default: m.Leaderboard })))

function App() {
  const { fetchUser, isLoading } = useAuthStore()

  // Hydrate session on mount
  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  if (isLoading) {
    return <GlobalSpinner />
  }

  return (
    <>
      <BrowserRouter>
        <Suspense fallback={<GlobalSpinner />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/room/:roomId" element={<DraftRoom />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <ToastContainer />
    </>
  )
}

export default App
