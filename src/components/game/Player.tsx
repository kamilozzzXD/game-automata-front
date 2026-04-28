import { GiWizardFace } from "react-icons/gi"
import type { Size, Vector2D } from "../../types/game"

type Props = {
  position: Vector2D
  size: Size
}

/**
 * Avatar del jugador. Posicionamiento absoluto controlado por el padre
 * (la escena), usando coordenadas X/Y del estado de React.
 */
export function Player({ position, size }: Props) {
  return (
    <div
      className="absolute z-20 flex items-center justify-center rounded-full bg-primary/90 ring-4 ring-primary/40 shadow-lg shadow-primary/30 transition-shadow"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
      aria-label="Jugador"
    >
      <GiWizardFace className="text-background" size={Math.floor(size.width * 0.7)} />
    </div>
  )
}
