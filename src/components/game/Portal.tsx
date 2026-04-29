import { GiVortex } from "react-icons/gi"
import type { Size, Vector2D } from "../../types/game"

type Props = {
  position: Vector2D
  size: Size
  isPlayerNear: boolean
  isBusy?: boolean
  // Etiqueta visible bajo el portal (default: "Bosque Profundo").
  label?: string
  // Texto que sigue al "Pulsa E" en el prompt de interaccion (default: "para explorar").
  actionLabel?: string
}

/**
 * Portal magico. Por defecto se usa para entrar al "Bosque Profundo" desde el claro,
 * pero tambien lo reutilizamos en la sala inicial de la mazmorra como puerta de salida.
 * Al interactuar con [E] el contenedor padre decide que accion ejecutar.
 */
export function Portal({
  position,
  size,
  isPlayerNear,
  isBusy = false,
  label = "Bosque Profundo",
  actionLabel = "para explorar",
}: Props) {
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
        className={`absolute inset-0 rounded-full bg-accent/40 blur-xl transition-opacity ${
          isPlayerNear ? "opacity-100 animate-pulse" : "opacity-0"
        }`}
        aria-hidden
      />

      {/* Sprite del portal */}
      <div
        className={`relative flex h-full w-full items-center justify-center rounded-full transition-transform ${
          isPlayerNear ? "scale-110" : "scale-100"
        }`}
      >
        <GiVortex
          className={`${
            isBusy ? "animate-spin text-accent" : isPlayerNear ? "text-accent" : "text-foreground/80"
          }`}
          size={Math.floor(size.width * 0.95)}
          style={!isBusy && isPlayerNear ? { animation: "spin 8s linear infinite" } : undefined}
        />
      </div>

      {/* Etiqueta visible siempre, para que el jugador entienda que es */}
      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-background/80 px-2 py-0.5 text-[11px] font-semibold text-foreground/90 shadow">
        {label}
      </div>

      {/* Prompt de interaccion */}
      {isPlayerNear && !isBusy && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-accent/60 bg-background/90 px-3 py-1 text-xs font-semibold text-accent shadow-md">
          Pulsa <kbd className="rounded bg-accent px-1.5 text-background">E</kbd> {actionLabel}
        </div>
      )}
    </div>
  )
}
