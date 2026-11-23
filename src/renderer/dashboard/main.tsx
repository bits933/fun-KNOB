import { createRoot } from 'react-dom/client'
import '@renderer/styles/tokens.css'
import './styles/dashboard.css'
import './ui'
import './app.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(<App />)
