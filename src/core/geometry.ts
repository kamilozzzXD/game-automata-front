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
 * de una entidad. Optimizado para evitar Math.sqrt() usando distancias al cuadrado.
 */
export function isWithinRadius(
  playerPos: Vector2D,
  playerSize: Size,
  targetPos: Vector2D,
  targetSize: Size,
  radius: number,
): boolean {
  const c1 = center(playerPos, playerSize)
  const c2 = center(targetPos, targetSize)
  const dx = c1.x - c2.x
  const dy = c1.y - c2.y
  return (dx * dx + dy * dy) <= radius * radius
}

/**
 * Colisiones circulares optimizadas evitando Math.sqrt()
 */
export function intersectsCircleOptimized(
  x1: number, y1: number, r1: number, 
  x2: number, y2: number, r2: number
): boolean {
  const dx = x2 - x1
  const dy = y2 - y1
  const distCuadrada = (dx * dx) + (dy * dy)
  const radioSuma = r1 + r2
  return distCuadrada < (radioSuma * radioSuma)
}

/**
 * Interseccion AABB (Axis-Aligned Bounding Box) entre dos rectangulos.
 * La usamos en la mazmorra para detectar cuando el jugador "cruza" una puerta.
 */
export function intersectsAABB(
  aPos: Vector2D,
  aSize: Size,
  bPos: Vector2D,
  bSize: Size,
): boolean {
  return (
    aPos.x < bPos.x + bSize.width &&
    aPos.x + aSize.width > bPos.x &&
    aPos.y < bPos.y + bSize.height &&
    aPos.y + aSize.height > bPos.y
  )
}
