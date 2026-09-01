import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './features/auth/AuthContext'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Using HashRouter for routing on GHPages. TODO: Switch to BrowserRouter for other environments */}
     <HashRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
)
