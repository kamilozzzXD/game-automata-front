import { GiPotionBall } from "react-icons/gi"
import { useGameStore } from "../../core/gameStore"

/**
 * Heads-Up Display: muestra contadores y controles en pantalla,
 * superpuesto sobre la escena.
 */
export function HUD() {
  const potions = useGameStore((s) => s.potionsCrafted)

  return (
    <>
      {/* Inventario / contadores */}
      <div className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm font-semibold text-foreground backdrop-blur">
        <GiPotionBall className="text-primary" size={20} />
        <span className="font-mono">{potions}</span>
        <span className="text-muted-foreground">pociones</span>
      </div>

      {/* Controles */}
      <div className="pointer-events-none absolute right-4 top-4 z-30 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
        <p>
          <kbd className="rounded bg-muted px-1 text-foreground">WASD</kbd> moverse
        </p>
        <p>
          <kbd className="rounded bg-muted px-1 text-foreground">E</kbd> interactuar
        </p>
      </div>
    </>
  )
}
