import { useEffect, useRef } from "react"
import { useGameStore } from "../core/gameStore"
import type { Size, Vector2D } from "../types/game"

type Options = {
  /** Posicion inicial / actual leida del store */
  position: Vector2D
  /** Setter del store */
  setPosition: (p: Vector2D) => void
  /** Tamano del jugador (para clamp dentro del mundo) */
  playerSize: Size
  /** Tamano del mundo (escena) */
  worldSize: Size
  /** Velocidad en pixeles por segundo */
  speed?: number
  /** Set de teclas actualmente presionadas (compartido con useGameKeyboard) */
  keysRef: React.RefObject<Set<string>>
  /** Permite pausar el movimiento (ej: cuando un modal esta abierto) */
  enabled: boolean
}

/**
 * Bucle de movimiento del jugador con matematicas simples:
 * - Lee teclas WASD/flechas desde keysRef.
 * - Calcula vector (dx, dy), lo normaliza si es diagonal.
 * - Aplica delta time para velocidad consistente.
 * - Hace clamp a los limites del mundo.
 * - Empuja la nueva posicion al store.
 *
 * Importante: usamos refs para no recrear el rAF cada render.
 */
export function usePlayerMovement({
  position,
  setPosition,
  playerSize,
  worldSize,
  speed = 220,
  keysRef,
  enabled,
}: Options) {
  // Espejo de la posicion en un ref para que el bucle no dependa del state
  const posRef = useRef<Vector2D>(position)
  posRef.current = position

  // Tarea 3.1 - Refs para no spamear setters de Zustand cada frame.
  // Solo escribimos al store cuando el VALOR realmente cambia.
  const lastDirRef = useRef<Vector2D>({ x: 0, y: 1 })
  const isMovingRef = useRef<boolean>(false)

  useEffect(() => {
    if (!enabled) {
      // Si el movimiento se deshabilita (modal abierto, generando mazmorra,
      // cambio de escena), forzamos a "quieto" para que el indicador
      // de apuntado se oculte. NO tocamos lastDirection a proposito:
      // queremos conservar la ultima orientacion entre escenas.
      if (isMovingRef.current) {
        isMovingRef.current = false
        useGameStore.getState().setIsPlayerMoving(false)
      }
      return
    }

    let rafId = 0
    let lastTime = performance.now()

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000 // segundos
      lastTime = now

      const keys = keysRef.current ?? new Set<string>()
      let dx = 0
      let dy = 0

      if (keys.has("w") || keys.has("arrowup")) dy -= 1
      if (keys.has("s") || keys.has("arrowdown")) dy += 1
      if (keys.has("a") || keys.has("arrowleft")) dx -= 1
      if (keys.has("d") || keys.has("arrowright")) dx += 1

      if (dx !== 0 || dy !== 0) {
        // Normalizar diagonal (Pitagoras): |v| = sqrt(dx^2 + dy^2)
        const len = Math.sqrt(dx * dx + dy * dy)
        dx /= len
        dy /= len

        // Tarea 3.1 - Sistema de 8 direcciones.
        // Guardamos el vector normalizado como "ultima direccion conocida"
        // para que el sistema de disparo sepa hacia donde lanzar el
        // proyectil incluso si el jugador suelta las teclas.
        const prev = lastDirRef.current
        if (prev.x !== dx || prev.y !== dy) {
          const next = { x: dx, y: dy }
          lastDirRef.current = next
          useGameStore.getState().setLastDirection(next)
        }
        if (!isMovingRef.current) {
          isMovingRef.current = true
          useGameStore.getState().setIsPlayerMoving(true)
        }

        const nextX = posRef.current.x + dx * speed * (useGameStore.getState().isSpeedActive ? 1.6 : 1) * dt
        const nextY = posRef.current.y + dy * speed * (useGameStore.getState().isSpeedActive ? 1.6 : 1) * dt

        // Clamp dentro del mundo (la posicion es la ESQUINA superior-izquierda)
        const clampedX = Math.max(0, Math.min(worldSize.width - playerSize.width, nextX))
        const clampedY = Math.max(
          0,
          Math.min(worldSize.height - playerSize.height, nextY),
        )

        if (clampedX !== posRef.current.x || clampedY !== posRef.current.y) {
          posRef.current = { x: clampedX, y: clampedY }
          setPosition(posRef.current)
        }
      } else if (isMovingRef.current) {
        // Tarea 3.1 - El jugador acaba de soltar las teclas.
        // CONSERVAMOS lastDirection (no la reseteamos) para que el
        // disparo en quietud apunte al ultimo lado mirado.
        isMovingRef.current = false
        useGameStore.getState().setIsPlayerMoving(false)
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
    // No incluimos position aqui a proposito: leemos via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, speed, worldSize.width, worldSize.height, playerSize.width, playerSize.height])
}
