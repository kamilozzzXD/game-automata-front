type Props = {
  /** Posicion del CENTRO del proyectil (no la esquina sup-izq). */
  x: number
  y: number
  /** Tamano del sprite (lado del cuadrado/diametro). */
  size?: number
}

/**
 * Sprite visual de un proyectil magico (Tarea 3.1).
 *
 * Estilo: bola luminosa con halo, color `accent` (consistente con el
 * indicador de apuntado del jugador). Es PURAMENTE decorativo: la
 * logica de movimiento, distancia recorrida y colision AABB vive en
 * `DungeonScene.tsx`.
 *
 * Convencion: este componente recibe la posicion de su CENTRO (a
 * diferencia de Player/Boss, que reciben la esquina sup-izq), porque
 * facilita los calculos del game loop (movimiento simetrico) y la
 * deteccion de impacto.
 */
export function Projectile({ x, y, size = 14 }: Props) {
  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
      }}
      aria-hidden
    >
      {/* Halo exterior pulsante */}
      <div
        className="absolute inset-0 rounded-full bg-accent/40 blur-sm"
        aria-hidden
      />
      {/* Nucleo brillante */}
      <div
        className="absolute inset-1 rounded-full bg-accent shadow-[0_0_10px_rgba(251,191,36,0.85)]"
        aria-hidden
      />
    </div>
  )
}
