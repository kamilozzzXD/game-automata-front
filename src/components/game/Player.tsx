import { useEffect, useState } from "react"
import { useGameStore } from "../../core/gameStore"
import type { Size, Vector2D } from "../../types/game"
import spritesheetUrl from "../../assets/character-spritesheet.png"

type Props = {
  position: Vector2D
  size: Size
}

// ==========================================
// CONFIGURACIÓN DEL SPRITESHEET (LPC Universal)
// ==========================================
// Los spritesheets de LPC tienen frames de 64x64
const SPRITE_WIDTH = 64 
const SPRITE_HEIGHT = 64 

// La animación de caminar tiene 9 frames
const WALK_FRAMES = 9 

// Velocidad en ms de cada frame (menor = más rápido)
const ANIMATION_SPEED_MS = 80 

// El estándar LPC usa estas filas para caminar:
const ROW_MAP = {
  up: 8,
  left: 9,
  down: 10,
  right: 11,
}
// ==========================================

/**
 * Avatar del jugador animado con spritesheet.
 */
export function Player({ position, size }: Props) {
  const isInvisible = useGameStore((s) => s.isPlayerInvisible)
  const lastDirection = useGameStore((s) => s.lastDirection)
  const isMoving = useGameStore((s) => s.isPlayerMoving)

  // Estado para la animación (índice actual del cuadro)
  const [frameIndex, setFrameIndex] = useState(0)

  // Calcular la dirección cardinal dominante para la animación
  let currentDir: keyof typeof ROW_MAP = "down"
  if (Math.abs(lastDirection.x) > Math.abs(lastDirection.y)) {
    currentDir = lastDirection.x > 0 ? "right" : "left"
  } else {
    currentDir = lastDirection.y < 0 ? "up" : "down"
  }
  const row = ROW_MAP[currentDir]

  // Bucle de animación
  useEffect(() => {
    if (!isMoving) {
      setFrameIndex(0) // Frame de reposo (idle)
      return
    }

    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % WALK_FRAMES)
    }, ANIMATION_SPEED_MS)

    return () => clearInterval(interval)
  }, [isMoving])

  // Indicador orbital (Tarea 3.1)
  const angleDeg =
    (Math.atan2(lastDirection.y, lastDirection.x) * 180) / Math.PI
  const orbitRadius = size.width / 2 + 10

  return (
    <div
      className={`absolute z-20 flex items-center justify-center rounded-full transition-opacity duration-300 ${
        isInvisible ? "ring-4 ring-cyan-400/40 shadow-lg shadow-cyan-300/40" : ""
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        opacity: isInvisible ? 0.4 : 1,
      }}
      aria-label={isInvisible ? "Jugador (invisible)" : "Jugador"}
    >
      {/* Contenedor del Spritesheet */}
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
            // Recorremos la grilla desplazando la imagen de fondo
            backgroundPosition: `-${frameIndex * SPRITE_WIDTH}px -${row * SPRITE_HEIGHT}px`,
            // Centramos el sprite de 64x64 sobre la colisión de 48x48
            left: "50%",
            top: "50%",
            // El sprite LPC suele tener mucho espacio transparente, lo escalamos un poco para que el personaje se vea bien
            transform: `translate(-50%, -60%) scale(1.5)`,
          }}
        />
      </div>

      {/* Indicador de apuntado */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 transition-opacity duration-150"
        style={{
          width: 0,
          height: 0,
          transform: `translate(-50%, -50%) rotate(${angleDeg}deg)`,
          opacity: isMoving ? 1 : 0,
        }}
        aria-hidden
      >
        <span
          className="absolute drop-shadow-[0_0_4px_rgba(255,255,255,0.7)]"
          style={{
            left: orbitRadius - 6,
            top: -6,
            width: 0,
            height: 0,
            borderTop: "6px solid transparent",
            borderBottom: "6px solid transparent",
            borderLeft: "10px solid var(--color-accent, #fbbf24)",
          }}
        />
      </div>
    </div>
  )
}
