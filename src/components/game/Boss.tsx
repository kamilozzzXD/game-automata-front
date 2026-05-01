import { useEffect, useState } from "react"
import {
  GiCrossedSwords,
  GiNightSleep,
} from "react-icons/gi"
import { FaExclamation } from "react-icons/fa"
import type { BossState } from "../../types/boss"
import type { Size, Vector2D } from "../../types/game"
import spritesheetUrl from "../../assets/boss-character-spritesheet.png"

// ==========================================
// CONFIGURACIÓN DEL SPRITESHEET DEL JEFE (LPC Universal)
// ==========================================
const SPRITE_WIDTH = 64
const SPRITE_HEIGHT = 64

// Mapeo de estados de la Máquina de Moore a filas/frames del spritesheet
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
 * Sprite del Jefe (Sprint 4 - Tarea 3).
 *
 * Diseno: distinto al jugador (sprite mas grande, paleta roja, corona
 * de calavera). Sobre la cabeza flota un icono de feedback que cambia
 * con el estado de la Maquina de Moore para que el jugador entienda
 * "en que esta pensando" el automata sin necesidad de leer logs.
 *
 *   A (Tranquilo) -> Zzz gris  -> Patrullar
 *   B (Tenso)     -> ! amarillo -> Buscar
 *   C (Agresivo)  -> Espadas rojas -> Atacar
 *
 * No tiene HP/colision real: solo es un objeto visual cuyo estado
 * controla la escena.
 */
export function Boss({ position, size, state }: Props) {
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
      aria-label={`Jefe en estado ${state}`}
    >
      {/* Indicador flotante encima de la cabeza */}
      <StateBadge state={state} />

      {/* Aura del jefe segun estado */}
      <div
        className={`absolute inset-0 rounded-full ${
          state === "C"
            ? "bg-red-500/35 animate-ping"
            : state === "B"
              ? "bg-amber-400/25 animate-pulse"
              : "bg-slate-400/15"
        }`}
        aria-hidden
      />

      {/* Cuerpo del jefe con el spritesheet */}
      <div
        className={`relative flex items-center justify-center rounded-full ring-4 transition-colors overflow-hidden ${
          state === "C"
            ? "bg-red-700/40 ring-red-400/70 shadow-[0_0_24px_rgba(220,38,38,0.7)]"
            : state === "B"
              ? "bg-red-900/40 ring-amber-400/60 shadow-[0_0_18px_rgba(251,191,36,0.55)]"
              : "bg-red-950/40 ring-slate-500/50 shadow-[0_0_14px_rgba(0,0,0,0.6)]"
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
              // Escalamos un poco para que llene bien su colisión
              transform: `translate(-50%, -60%) scale(1.6)`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Icono flotante encima del jefe: muestra en que estado de la
 * Maquina de Moore se encuentra. Lo posicionamos con translate
 * negativo en Y para que quede claramente sobre la cabeza.
 */
function StateBadge({ state }: { state: BossState }) {
  if (state === "A") {
    return (
      <div
        className="absolute -top-10 flex items-center gap-1 rounded-full border border-slate-400/40 bg-background/85 px-2 py-0.5 text-xs font-bold text-slate-300 shadow"
        aria-label="Estado A: Patrullar"
      >
        <GiNightSleep size={14} />
        <span className="uppercase tracking-wider">A</span>
      </div>
    )
  }

  if (state === "B") {
    return (
      <div
        className="absolute -top-10 flex items-center gap-1 rounded-full border border-amber-400/60 bg-background/85 px-2 py-0.5 text-xs font-bold text-amber-300 shadow animate-pulse"
        aria-label="Estado B: Buscar"
      >
        <FaExclamation size={12} />
        <span className="uppercase tracking-wider">B</span>
      </div>
    )
  }

  // C
  return (
    <div
      className="absolute -top-10 flex items-center gap-1 rounded-full border border-red-500/70 bg-background/90 px-2 py-0.5 text-xs font-bold text-red-300 shadow"
      aria-label="Estado C: Atacar"
    >
      <GiCrossedSwords size={14} />
      <span className="uppercase tracking-wider">C</span>
    </div>
  )
}
