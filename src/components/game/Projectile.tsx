import ataqueGifUrl from "../../assets/fireball-fire.gif"

/**
 * Variantes visuales del proyectil.
 *  - "player"      : disparo del jugador. Usa ataque.gif.
 *  - "boss-basic"  : disparo basico del jefe en estado C. Rojo.
 *  - "boss-heavy"  : Ataque Pesado del Modo Furia (Tarea 3.2). Morado oscuro,
 *                    el doble de tamano y con halo cargado para indicar al
 *                    jugador que VIENE algo gordo y debe esquivarlo o se
 *                    fragmentara en 8 al expirar.
 */
export type ProjectileVariant = "player" | "boss-basic" | "boss-heavy" | "boss-poison"

type Props = {
  /** Posicion del CENTRO del proyectil (no la esquina sup-izq). */
  x: number
  y: number
  /** Tamano del sprite (lado del cuadrado/diametro). */
  size?: number
  /** Estilo visual + bando del proyectil. Default: "player". */
  variant?: ProjectileVariant
}

/**
 * Sprite visual de un proyectil magico (Tareas 3.1 y 3.2).
 *
 * Es PURAMENTE decorativo: la logica de movimiento, distancia recorrida,
 * fragmentacion y colision AABB vive en `DungeonScene.tsx`.
 *
 * Convencion: este componente recibe la posicion de su CENTRO (a
 * diferencia de Player/Boss, que reciben la esquina sup-izq), porque
 * facilita los calculos del game loop (movimiento simetrico) y la
 * deteccion de impacto.
 */
export function Projectile({ x, y, size = 14, variant = "player" }: Props) {
  // Estilos por variante. Mantenemos la paleta semantica donde se puede,
  // pero los rojos/morados los hardcodeamos porque NO existen en los
  // tokens del proyecto y los necesitamos para el contraste visual del
  // bando enemigo (spec Tarea 3.2: "rojo o morado oscuro").
  const variantClasses =
    variant === "player"
      ? {
        halo: "", // No aplica para el GIF
        core: "",
      }
      : variant === "boss-basic"
        ? {
          halo: "bg-red-500/40 blur-sm",
          core: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.85)]",
        }
        : variant === "boss-poison"
          ? {
            halo: "bg-emerald-500/40 blur-sm",
            core: "bg-emerald-500 ring-1 ring-emerald-300 shadow-[0_0_10px_rgba(34,197,94,0.9)] animate-pulse",
          }
          : {
            // boss-heavy: Modo Furia. Mas saturado y con un anillo extra
            // que pulsa para que el jugador "lea" que es peligroso.
            halo: "bg-purple-700/55 blur-md animate-pulse",
            core:
              "bg-purple-900 ring-2 ring-purple-400/70 shadow-[0_0_18px_rgba(126,34,206,0.95)]",
          }

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
      {variant === "player" ? (
        // Sprite del proyectil del jugador
        <img
          src={ataqueGifUrl}
          alt="Proyectil del jugador"
          className="absolute inset-0 w-full h-full object-contain"
          // Hacemos el GIF ligeramente más grande que el hitbox para que se vea mejor visualmente
          style={{ transform: "scale(2.5)" }}
        />
      ) : (
        // Proyectiles del jefe
        <>
          {/* Halo exterior */}
          <div className={`absolute inset-0 rounded-full ${variantClasses.halo}`} aria-hidden />
          {/* Nucleo brillante */}
          <div
            className={`absolute inset-1 rounded-full ${variantClasses.core}`}
            aria-hidden
          />
        </>
      )}
    </div>
  )
}
