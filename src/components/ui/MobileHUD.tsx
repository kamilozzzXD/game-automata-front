import React, { useRef, useState } from "react"
import { useGameStore } from "../../core/gameStore"

/**
 * MobileHUD: Componente de interfaz táctil flotante con un Joystick Virtual optimizado.
 * Implementa el patrón de Gating (Acumulación) mediante requestAnimationFrame para evitar
 * saturar el Event Loop de Zustand con eventos de arrastre a 120Hz/240Hz.
 */
export function MobileHUD() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 })

  // Refs de Gating (memoria temporal volátil)
  const pendingVectorRef = useRef({ x: 0, y: 0 })
  const isGatingActiveRef = useRef(false)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    updateJoystick(e)
  }

  const updateJoystick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    const dx = e.clientX - centerX
    const dy = e.clientY - centerY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const maxRadius = 45 // Radio máximo de movimiento del joystick en px

    let nx = dx
    let ny = dy
    if (distance > maxRadius) {
      nx = (dx / distance) * maxRadius
      ny = (dy / distance) * maxRadius
    }

    setKnobPos({ x: nx, y: ny })

    // Cálculo rápido y asignación en memoria volátil (120+ veces por segundo)
    const normalX = nx / maxRadius
    const normalY = ny / maxRadius
    pendingVectorRef.current = { x: normalX, y: normalY }

    // Encender el motor de inyección si no está activo
    if (!isGatingActiveRef.current) {
      isGatingActiveRef.current = true
      requestAnimationFrame(tickJoystickToStore)
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    updateJoystick(e)
  }

  const handlePointerUp = () => {
    setDragging(false)
    setKnobPos({ x: 0, y: 0 })
    pendingVectorRef.current = { x: 0, y: 0 }
  }

  const tickJoystickToStore = () => {
    // Inyección controlada a Zustand (Máximo 60 veces por segundo)
    useGameStore.getState().setJoystickVector(pendingVectorRef.current)
    
    // Si el usuario soltó el joystick, apagar el gating
    if (pendingVectorRef.current.x === 0 && pendingVectorRef.current.y === 0) {
      isGatingActiveRef.current = false
    } else {
      requestAnimationFrame(tickJoystickToStore)
    }
  }

  return (
    <div 
      className="absolute bottom-6 left-6 z-40 select-none touch-none md:hidden"
      style={{ pointerEvents: "auto" }}
      aria-label="Controles táctiles"
    >
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative flex h-28 w-28 items-center justify-center rounded-full border border-white/20 bg-black/30 shadow-2xl backdrop-blur-md cursor-grab active:cursor-grabbing"
      >
        {/* Centro de referencia */}
        <div className="h-4 w-4 rounded-full bg-white/10" />

        {/* Anillo de pulso exterior */}
        <div className="absolute inset-2 rounded-full border border-primary/20 pointer-events-none animate-pulse" />

        {/* Mando (Knob) interactivo */}
        <div
          className={`absolute h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 shadow-lg border border-white/30 transition-shadow ${
            dragging ? "shadow-[0_0_15px_rgba(139,92,246,0.6)] cursor-grabbing" : "cursor-grab"
          }`}
          style={{
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
            transition: dragging ? "none" : "transform 0.15s ease-out",
          }}
        />
      </div>
    </div>
  )
}
