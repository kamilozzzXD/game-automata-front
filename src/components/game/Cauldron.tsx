import { GiCauldron } from "react-icons/gi"
import type { Size, Vector2D } from "../../types/game"

type Props = {
  position: Vector2D
  size: Size
  isPlayerNear: boolean
  onlyOverlay?: boolean
}

/**
 * Caldero como objeto interactuable en la escena.
 * Cuando el jugador esta dentro del radio, brilla y muestra un prompt "[E]".
 */
export function Cauldron({ position, size, isPlayerNear, onlyOverlay = false }: Props) {
  if (onlyOverlay) {
    return (
      <div
        className="absolute z-10 flex flex-col items-center pointer-events-none"
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
        }}
      >
        {/* Prompt de interaccion */}
        {isPlayerNear && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-primary/60 bg-background/90 px-3 py-1 text-xs font-semibold text-primary shadow-md pointer-events-auto">
            Pulsa <kbd className="rounded bg-primary px-1.5 text-background">E</kbd> para usar
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="absolute z-10 flex flex-col items-center"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
    >
      {/* Halo cuando el jugador esta cerca */}
      <div
        className={`absolute inset-0 rounded-full bg-primary/30 blur-xl transition-opacity ${
          isPlayerNear ? "opacity-100 animate-pulse" : "opacity-0"
        }`}
        aria-hidden
      />

      {/* Sprite del caldero */}
      <div
        className={`relative flex h-full w-full items-center justify-center rounded-lg transition-transform ${
          isPlayerNear ? "scale-110" : "scale-100"
        }`}
      >
        <GiCauldron
          className={isPlayerNear ? "text-primary" : "text-foreground/80"}
          size={Math.floor(size.width * 0.95)}
        />
      </div>

      {/* Prompt de interaccion */}
      {isPlayerNear && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-primary/60 bg-background/90 px-3 py-1 text-xs font-semibold text-primary shadow-md">
          Pulsa <kbd className="rounded bg-primary px-1.5 text-background">E</kbd> para usar
        </div>
      )}
    </div>
  )
}
