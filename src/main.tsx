import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// LocatorJS - Dev only.
// Permite Alt-Click (Option-Click en macOS) sobre cualquier elemento de la UI
// para abrirlo directamente en VS Code / Cursor / WebStorm en la linea exacta
// del componente JSX. Ahorra muchisimo tiempo navegando un proyecto grande.
//
// Notas:
// - Se carga SOLO en `import.meta.env.DEV` para que no entre al bundle de
//   produccion (cero impacto en build/perf finales).
// - Vite + @vitejs/plugin-react ya inyecta la metadata `__source` que
//   LocatorJS necesita para mapear el DOM al archivo fuente, por lo que
//   no hace falta ningun plugin adicional.
// - El `import()` dinamico evita siquiera resolver el modulo en produccion.
if (import.meta.env.DEV) {
  import('@locator/runtime').then(({ default: setupLocatorUI }) => {
    setupLocatorUI()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
