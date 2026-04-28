import type { Size, Vector2D } from "../types/game"

/** Distancia euclidiana entre dos puntos. */
export function distance(a: Vector2D, b: Vector2D): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** Centro de una entidad rectangular (posicion = esquina sup-izq). */
export function center(pos: Vector2D, size: Size): Vector2D {
  return { x: pos.x + size.width / 2, y: pos.y + size.height / 2 }
}

/**
 * True si el centro del jugador esta dentro del radio de interaccion
 * de una entidad. Suficiente para Sprint 1.
 */
export function isWithinRadius(
  playerPos: Vector2D,
  playerSize: Size,
  targetPos: Vector2D,
  targetSize: Size,
  radius: number,
): boolean {
  return distance(center(playerPos, playerSize), center(targetPos, targetSize)) <= radius
}
