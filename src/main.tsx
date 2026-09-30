import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@vinted/web-ui/dist/styles/vinted/style.css'
import './fonts.css'
import './site.css'
import { App } from './App'
import { followSystemTheme } from './theme'

followSystemTheme()
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
