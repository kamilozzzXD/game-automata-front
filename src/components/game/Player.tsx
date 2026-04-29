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
 */
export function Player({ position, size }: Props) {
  const isInvisible = useGameStore((s) => s.isPlayerInvisible)

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
    </div>
  )
}
