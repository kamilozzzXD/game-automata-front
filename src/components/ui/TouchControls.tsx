import React from "react"
import { useMobileDetection } from "../../hooks/useMobileDetection"

/**
 * TouchControls
 *
 * Mando de botones de acción táctiles translúcidos para móvil.
 * Despacha eventos KeyboardEvent sintéticos a window para simular
 * pulsaciones físicas y evitar latencia y bugs de "teclas pegadas".
 */
export function TouchControls() {
  const { isMobile } = useMobileDetection()

  if (!isMobile) return null

  // Despacha eventos de teclado sintéticos
  const dispatchKey = (keyName: string, eventType: "keydown" | "keyup") => {
    const event = new KeyboardEvent(eventType, {
      key: keyName,
      code: `Key${keyName.toUpperCase()}`,
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(event)
  }

  const handlePointerDown = (e: React.PointerEvent, keyName: string) => {
    e.preventDefault()
    dispatchKey(keyName, "keydown")
  }

  const handlePointerUp = (e: React.PointerEvent, keyName: string) => {
    e.preventDefault()
    dispatchKey(keyName, "keyup")
  }

  return (
    <div
      className="absolute bottom-4 right-4 z-50 pointer-events-none select-none touch-none w-40 h-40"
    >
      {/* Botón Interactuar (E) - Arriba */}
      <button
        onPointerDown={(e) => handlePointerDown(e, "e")}
        onPointerUp={(e) => handlePointerUp(e, "e")}
        onPointerLeave={(e) => handlePointerUp(e, "e")}
        onPointerCancel={(e) => handlePointerUp(e, "e")}
        className="pointer-events-auto absolute top-0 left-[56px] flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/40 backdrop-blur-md border border-white/20 text-white shadow-lg active:bg-slate-700/60 active:scale-95 transition-all cursor-pointer"
        style={{ touchAction: "none" }}
        aria-label="Interactuar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-300"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </button>

      {/* Botón Inventario (I) - Izquierda */}
      <button
        onPointerDown={(e) => handlePointerDown(e, "i")}
        onPointerUp={(e) => handlePointerUp(e, "i")}
        onPointerLeave={(e) => handlePointerUp(e, "i")}
        onPointerCancel={(e) => handlePointerUp(e, "i")}
        className="pointer-events-auto absolute left-0 top-[56px] flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/40 backdrop-blur-md border border-white/20 text-white shadow-lg active:bg-slate-700/60 active:scale-95 transition-all cursor-pointer"
        style={{ touchAction: "none" }}
        aria-label="Inventario"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-violet-300"
        >
          <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          <rect width="20" height="14" x="2" y="6" rx="2" />
        </svg>
      </button>

      {/* Botón Usar Poción (Q) - Derecha */}
      <button
        onPointerDown={(e) => handlePointerDown(e, "q")}
        onPointerUp={(e) => handlePointerUp(e, "q")}
        onPointerLeave={(e) => handlePointerUp(e, "q")}
        onPointerCancel={(e) => handlePointerUp(e, "q")}
        className="pointer-events-auto absolute right-0 top-[56px] flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/40 backdrop-blur-md border border-white/20 text-white shadow-lg active:bg-slate-700/60 active:scale-95 transition-all cursor-pointer"
        style={{ touchAction: "none" }}
        aria-label="Usar Poción"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-400"
        >
          <path d="M10 2h4" />
          <path d="M12 2v3" />
          <path d="M19 14.5A7 7 0 0 1 12 21a7 7 0 0 1-7-6.5L8 5h8l3 9.5z" />
        </svg>
      </button>

      {/* Botón ATK (Disparar - J) - Abajo */}
      <button
        onPointerDown={(e) => handlePointerDown(e, "j")}
        onPointerUp={(e) => handlePointerUp(e, "j")}
        onPointerLeave={(e) => handlePointerUp(e, "j")}
        onPointerCancel={(e) => handlePointerUp(e, "j")}
        className="pointer-events-auto absolute bottom-0 left-[48px] flex h-16 w-16 items-center justify-center rounded-full bg-slate-900/40 backdrop-blur-md border border-white/20 text-white shadow-lg active:bg-slate-700/60 active:scale-95 transition-all cursor-pointer"
        style={{ touchAction: "none" }}
        aria-label="Atacar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-red-400 animate-pulse"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="22" y1="12" x2="18" y2="12" />
          <line x1="6" y1="12" x2="2" y2="12" />
          <line x1="12" y1="6" x2="12" y2="2" />
          <line x1="12" y1="22" x2="12" y2="18" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  )
}
