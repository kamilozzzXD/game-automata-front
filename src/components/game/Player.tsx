import { GiWizardFace } from "react-icons/gi"
import { useGameStore } from "../../core/gameStore"
import type { Size, Vector2D } from "../../types/game"

type Props = {
  position: Vector2D
  size: Size
}

/**
 * Avatar del jugador. Posicionamiento absoluto controlado por el padre
 * (la escena), usando coordenadas X/Y del estado de React.
 *
 * Sprint 4: cuando la Pocion de Invisibilidad esta activa, bajamos la
 * opacidad para que el jugador "se note translucido". Mantenemos el
 * color original del sprite (no lo tinetamos) para que sea claro que
 * el efecto es temporal y no un cambio de personaje.
 *
 * Tarea 3.1 - Sistema de orientacion:
 *   - Lee `lastDirection` y `isPlayerMoving` del store global.
 *   - Renderiza un pequeno triangulo CSS que orbita al jugador
 *     apuntando hacia la direccion en la que esta caminando.
 *   - Solo es visible cuando el jugador se esta moviendo (cuando esta
 *     quieto el indicador se oculta, pero la direccion se conserva
 *     internamente para que el disparo sepa hacia donde apuntar).
 */
export function Player({ position, size }: Props) {
  const isInvisible = useGameStore((s) => s.isPlayerInvisible)
  const lastDirection = useGameStore((s) => s.lastDirection)
  const isMoving = useGameStore((s) => s.isPlayerMoving)

  // Math.atan2(dy, dx) -> radianes en el rango (-PI, PI].
  // Multiplicamos por 180/PI para llevarlo a grados (CSS rotate).
  // En CSS:  0deg = derecha, 90deg = abajo, 180deg = izquierda, -90deg = arriba.
  // Ese mapping ya coincide con el resultado de atan2 en nuestro sistema
  // de coordenadas (Y crece hacia abajo en la pantalla), asi que NO hay
  // que sumar offsets adicionales para alinear el indicador.
  const angleDeg =
    (Math.atan2(lastDirection.y, lastDirection.x) * 180) / Math.PI

  // Radio en pixeles desde el centro del jugador hasta el indicador.
  const orbitRadius = size.width / 2 + 10

  return (
    <div
      className={`absolute z-20 flex items-center justify-center rounded-full bg-primary/90 ring-4 ring-primary/40 shadow-lg shadow-primary/30 transition-opacity duration-300 ${
        isInvisible ? "ring-cyan-400/40 shadow-cyan-300/40" : ""
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
      <GiWizardFace className="text-background" size={Math.floor(size.width * 0.7)} />

      {/* Indicador de apuntado (Tarea 3.1).
          Wrapper centrado en el jugador. El triangulo interno apunta a
          la DERECHA por defecto (forma CSS), por lo que basta con rotar
          el wrapper por `angleDeg` para que apunte a la direccion real.
          La punta queda a `orbitRadius` pixeles del centro. */}
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
        {/* Triangulo CSS apuntando a la derecha:
            usa bordes transparentes en top/bottom y un borde solido en
            left para formar la punta. La forma se posiciona offset hacia
            la derecha con `left: orbitRadius - 6`. */}
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
