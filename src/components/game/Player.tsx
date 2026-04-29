import { GiWizardFace } from "react-icons/gi"
import { useGameStore } from "../../core/gameStore"
import type { Size, Vector2D } from "../../types/game"

type Props = {
  position: Vector2D
  size: Size
}

/**
 * Avatar del jugador.
 *
 * Sprint 4: opacidad reducida cuando esta invisible.
 *
 * Sprint 5 - Tarea 3.B: indicador de direccion (arco/flecha curvada
 * en el contorno externo del circulo) que apunta hacia donde mira el
 * jugador. Solo se muestra mientras se mantiene una tecla WASD
 * presionada (`isPlayerMoving`). Soporta 8 direcciones (horizontal,
 * vertical y diagonal) calculando el angulo a partir del vector de
 * mira (`playerFacing`).
 *
 * Como el jugador es un circulo, en lugar de "rotar el sprite" lo
 * que hacemos es renderizar un arco semitransparente FUERA del
 * circulo (rotando un contenedor absolute con CSS `rotate(...)`).
 */
export function Player({ position, size }: Props) {
  const isInvisible = useGameStore((s) => s.isPlayerInvisible)
  const facing = useGameStore((s) => s.playerFacing)
  const isMoving = useGameStore((s) => s.isPlayerMoving)
  const hitFlashAt = useGameStore((s) => s.playerHitFlashAt)

  // Angulo (en grados) desde el centro del jugador hacia donde mira.
  // En CSS, 0 grados apunta a la DERECHA y crece en sentido horario.
  // Math.atan2 nos da exactamente eso (con Y invertida en pantalla).
  const angleDeg = (Math.atan2(facing.y, facing.x) * 180) / Math.PI

  // Flash rojo al recibir daño (300ms). Suficiente como pista visual
  // sin que el jugador pierda de vista al personaje.
  const isFlashing = Date.now() - hitFlashAt < 300

  return (
    <div
      className={`absolute z-20 transition-opacity duration-300 ${
        isFlashing ? "animate-pulse" : ""
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
      {/* Cuerpo del jugador (circulo) */}
      <div
        className={`relative flex h-full w-full items-center justify-center rounded-full bg-primary/90 ring-4 shadow-lg shadow-primary/30 ${
          isFlashing
            ? "ring-red-500"
            : isInvisible
              ? "ring-cyan-400/40 shadow-cyan-300/40"
              : "ring-primary/40"
        }`}
      >
        <GiWizardFace
          className="text-background"
          size={Math.floor(size.width * 0.7)}
        />
      </div>

      {/*
        Indicador de mira: contenedor del MISMO tamano que el jugador,
        centrado en el mismo punto. Lo rotamos por CSS y dentro pintamos
        un "arco" pegado al borde exterior derecho. Como rotamos a partir
        del centro, el arco "recorre" todo el contorno segun la direccion.
      */}
      {isMoving && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ transform: `rotate(${angleDeg}deg)` }}
          aria-hidden
        >
          <FacingArc />
        </div>
      )}
    </div>
  )
}

/**
 * Arco semicircular dibujado FUERA del circulo del jugador, sobre su
 * lado derecho (porque la rotacion del padre ya lo orienta). Usamos un
 * SVG simple con un path en arco para que la curva siga la silueta.
 */
function FacingArc() {
  // Posicionado a la derecha del jugador (centro del padre = 50% / 50%).
  return (
    <svg
      className="absolute"
      style={{
        // El arco vive en una caja fuera del cuerpo (a la derecha).
        // 56px de ancho cubre el "pico" de la flecha.
        left: "50%",
        top: "50%",
        width: "56px",
        height: "56px",
        transform: "translate(-2px, -50%)",
      }}
      viewBox="0 0 56 56"
    >
      {/* Arco principal: semicirculo que rodea la mitad derecha */}
      <path
        d="M 28 4 A 24 24 0 0 1 28 52"
        fill="none"
        stroke="#fde68a"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* Punta de flecha indicando "hacia adelante" */}
      <polygon
        points="48,20 56,28 48,36"
        fill="#fde68a"
        opacity="0.95"
      />
    </svg>
  )
}
