import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Não foi possível encontrar o elemento raiz da aplicação.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)