import { useEffect, useState } from "react"
import {
  GiCrossedSwords,
  GiNightSleep,
} from "react-icons/gi"
import { FaExclamation } from "react-icons/fa"
import type { BossState } from "../../types/boss"
import type { Size, Vector2D } from "../../types/game"
import skeletonSpritesheet from "../../assets/enemy-spritesheet.png"
import ghostSpritesheet from "../../assets/ghost-character-spritesheet.png"
import witchSpritesheet from "../../assets/witch-character-spritesheet.png"

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
  type?: "skeleton" | "ghost" | "witch"
}

/**
 * Sprite del Mini-Boss para salas secretas con variantes de Fantasma y Bruja.
 * Cuenta con efectos estéticos de alto rendimiento que cambian su silueta física:
 *  - Fantasma: Flota en el aire, se desvanecen sus piernas en degradado y brilla en cian.
 *  - Bruja: Burbujas de veneno en tiempo real y círculo rúnico giratorio en la base.
 */
export function MiniBoss({ position, size, state, type = "skeleton" }: Props) {
  const [frameIndex, setFrameIndex] = useState(0)

  const spritesheetUrl = type === "ghost"
    ? ghostSpritesheet
    : type === "witch"
      ? witchSpritesheet
      : skeletonSpritesheet

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

  // Configuración de estilos según tipo
  let auraClass = ""
  let bodyClass = ""
  let filterStyle: React.CSSProperties = {}

  if (type === "ghost") {
    auraClass = state === "C"
      ? "bg-cyan-500/35 animate-ping"
      : state === "B"
        ? "bg-teal-400/25 animate-pulse"
        : "bg-cyan-400/15"
    bodyClass = state === "C"
      ? "bg-cyan-700/20 ring-cyan-400/70"
      : state === "B"
        ? "bg-cyan-900/20 ring-cyan-500/50"
        : "bg-cyan-950/20 ring-cyan-600/40"
    
    // Máscara espectral: desvanece las piernas para dar forma incorpórea
    filterStyle = { 
      filter: "opacity(0.8) drop-shadow(0 0 10px rgba(6,182,212,0.9))",
      WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 92%)",
      maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 92%)",
    }
  } else if (type === "witch") {
    auraClass = state === "C"
      ? "bg-emerald-500/35 animate-ping"
      : state === "B"
        ? "bg-green-400/25 animate-pulse"
        : "bg-emerald-400/15"
    bodyClass = state === "C"
      ? "bg-emerald-700/40 ring-emerald-400/70 shadow-[0_0_16px_rgba(52,211,153,0.75)]"
      : state === "B"
        ? "bg-green-900/40 ring-green-400/60 shadow-[0_0_12px_rgba(74,222,128,0.6)]"
        : "bg-emerald-950/40 ring-emerald-600/50 shadow-[0_0_10px_rgba(5,150,105,0.5)]"
    filterStyle = {}
  } else {
    // skeleton default
    auraClass = state === "C"
      ? "bg-purple-500/35 animate-ping"
      : state === "B"
        ? "bg-pink-400/25 animate-pulse"
        : "bg-indigo-400/15"
    bodyClass = state === "C"
      ? "bg-purple-700/40 ring-purple-400/70 shadow-[0_0_16px_rgba(168,85,247,0.7)]"
      : state === "B"
        ? "bg-pink-900/40 ring-pink-400/60 shadow-[0_0_12px_rgba(236,72,153,0.55)]"
        : "bg-indigo-950/40 ring-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.6)]"
  }

  return (
    <div
      className={`pointer-events-none absolute z-20 flex flex-col items-center ${
        type === "ghost" ? "animate-float" : ""
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
      aria-label={`Mini-Boss en estado ${state}`}
    >
      {/* Indicador flotante encima de la cabeza */}
      <StateBadge state={state} type={type} />

      {/* Círculo rúnico giratorio debajo de los pies de la Bruja */}
      {type === "witch" && (
        <div
          className="absolute rounded-full border border-emerald-500/30 animate-spin"
          style={{
            width: size.width + 16,
            height: size.height + 16,
            background: "radial-gradient(circle, rgba(16,185,129,0.1) 20%, transparent 80%)",
            animationDuration: "10s",
            zIndex: -1,
            top: -8,
            left: -8,
          }}
          aria-hidden
        />
      )}

      {/* Aura del mini-jefe segun estado */}
      <div className={`absolute inset-0 rounded-full ${auraClass}`} aria-hidden />

      {/* Cuerpo del mini-jefe con el spritesheet */}
      <div
        className={`relative flex items-center justify-center rounded-full ring-2 transition-colors overflow-hidden ${bodyClass}`}
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
              ...filterStyle,
            }}
          />
        </div>
      </div>

      {/* Partículas de gas tóxico flotantes para la Bruja */}
      {type === "witch" && (
        <div className="absolute inset-0 pointer-events-none overflow-visible">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute opacity-70 animate-toxic" style={{ left: "10px", bottom: "10px", animationDelay: "0.2s" }} />
          <div className="w-2 h-2 rounded-full bg-green-500 absolute opacity-80 animate-toxic" style={{ left: "45px", bottom: "15px", animationDelay: "0.6s" }} />
          <div className="w-1 h-1 rounded-full bg-emerald-300 absolute opacity-90 animate-toxic" style={{ left: "20px", bottom: "5px", animationDelay: "1.1s" }} />
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 absolute opacity-70 animate-toxic" style={{ left: "35px", bottom: "20px", animationDelay: "1.5s" }} />
        </div>
      )}
    </div>
  )
}

function StateBadge({ state, type }: { state: BossState; type: "skeleton" | "ghost" | "witch" }) {
  const label = type === "skeleton" ? "Esqueleto" : type === "ghost" ? "Fantasma" : "Bruja"
  const colorClass = type === "skeleton"
    ? "border-indigo-400/40 text-indigo-300"
    : type === "ghost"
      ? "border-cyan-400/50 text-cyan-300 animate-pulse"
      : "border-emerald-400/50 text-emerald-300"

  if (state === "A") {
    return (
      <div
        className={`absolute -top-8 flex items-center gap-1 rounded-full border bg-background/85 px-2 py-0.5 text-[10px] font-bold ${colorClass} shadow`}
      >
        <GiNightSleep size={12} />
        <span className="uppercase tracking-wider">A - {label}</span>
      </div>
    )
  }

  if (state === "B") {
    return (
      <div
        className={`absolute -top-8 flex items-center gap-1 rounded-full border bg-background/85 px-2 py-0.5 text-[10px] font-bold ${colorClass} shadow animate-pulse`}
      >
        <FaExclamation size={10} />
        <span className="uppercase tracking-wider">B - {label}</span>
      </div>
    )
  }

  return (
    <div
      className={`absolute -top-8 flex items-center gap-1 rounded-full border bg-background/90 px-2 py-0.5 text-[10px] font-bold ${colorClass} shadow`}
    >
      <GiCrossedSwords size={12} />
      <span className="uppercase tracking-wider">C - {label}</span>
    </div>
  )
}
