import { useEffect, useState } from "react"
import {
  GiCrossedSwords,
  GiNightSleep,
} from "react-icons/gi"
import { FaExclamation } from "react-icons/fa"
import type { BossState } from "../../types/boss"
import type { Size, Vector2D } from "../../types/game"
import spritesheetUrl from "../../assets/enemy-spritesheet.png"

// ==========================================
// CONFIGURACIÓN DEL SPRITESHEET DEL MINI-BOSS (LPC)
// ==========================================
const SPRITE_WIDTH = 64
const SPRITE_HEIGHT = 64

const ANIMATION_MAP: Record<BossState, { row: number; frames: number; speed: number }> = {
  A: { row: 10, frames: 9, speed: 180 }, // Tranquilo: caminar lento hacia abajo (Fila 10)
  B: { row: 10, frames: 9, speed: 90 },  // Alerta: caminar rápido (Fila 10)
  C: { row: 2, frames: 7, speed: 80 },   // Ataque: conjuro rápido (Fila 2)
}
// ==========================================

type Props = {
  position: Vector2D
  size: Size
  state: BossState
}

/**
 * Sprite del Mini-Boss para salas secretas.
 */
export function MiniBoss({ position, size, state }: Props) {
  const [frameIndex, setFrameIndex] = useState(0)

  // Bucle de animación que depende del estado actual
  useEffect(() => {
    setFrameIndex(0) // Reiniciar al cambiar de estado
    const { frames, speed } = ANIMATION_MAP[state]
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames)
    }, speed)
    return () => clearInterval(interval)
  }, [state])

  const { row } = ANIMATION_MAP[state]

  return (
    <div
      className="pointer-events-none absolute z-20 flex flex-col items-center"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
      aria-label={`Mini-Boss en estado ${state}`}
    >
      {/* Indicador flotante encima de la cabeza */}
      <StateBadge state={state} />

      {/* Aura del mini-jefe segun estado */}
      <div
        className={`absolute inset-0 rounded-full ${
          state === "C"
            ? "bg-purple-500/35 animate-ping"
            : state === "B"
              ? "bg-pink-400/25 animate-pulse"
              : "bg-indigo-400/15"
        }`}
        aria-hidden
      />

      {/* Cuerpo del mini-jefe con el spritesheet */}
      <div
        className={`relative flex items-center justify-center rounded-full ring-2 transition-colors overflow-hidden ${
          state === "C"
            ? "bg-purple-700/40 ring-purple-400/70 shadow-[0_0_16px_rgba(168,85,247,0.7)]"
            : state === "B"
              ? "bg-pink-900/40 ring-pink-400/60 shadow-[0_0_12px_rgba(236,72,153,0.55)]"
              : "bg-indigo-950/40 ring-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.6)]"
        }`}
        style={{
          width: size.width,
          height: size.height,
        }}
      >
        <div 
          className="absolute overflow-visible"
          style={{ width: "100%", height: "100%" }}
        >
          <div
            className="absolute"
            style={{
              backgroundImage: `url(${spritesheetUrl})`,
              backgroundRepeat: "no-repeat",
              width: SPRITE_WIDTH,
              height: SPRITE_HEIGHT,
              backgroundPosition: `-${frameIndex * SPRITE_WIDTH}px -${row * SPRITE_HEIGHT}px`,
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -60%) scale(1.6)`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

function StateBadge({ state }: { state: BossState }) {
  if (state === "A") {
    return (
      <div
        className="absolute -top-8 flex items-center gap-1 rounded-full border border-indigo-400/40 bg-background/85 px-2 py-0.5 text-[10px] font-bold text-indigo-300 shadow"
      >
        <GiNightSleep size={12} />
        <span className="uppercase tracking-wider">A</span>
      </div>
    )
  }

  if (state === "B") {
    return (
      <div
        className="absolute -top-8 flex items-center gap-1 rounded-full border border-pink-400/60 bg-background/85 px-2 py-0.5 text-[10px] font-bold text-pink-300 shadow animate-pulse"
      >
        <FaExclamation size={10} />
        <span className="uppercase tracking-wider">B</span>
      </div>
    )
  }

  return (
    <div
      className="absolute -top-8 flex items-center gap-1 rounded-full border border-purple-500/70 bg-background/90 px-2 py-0.5 text-[10px] font-bold text-purple-300 shadow"
    >
      <GiCrossedSwords size={12} />
      <span className="uppercase tracking-wider">C</span>
    </div>
  )
}
