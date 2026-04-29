import { useMemo } from "react"
import { GiPotionBall, GiTrashCan } from "react-icons/gi"
import { useGameStore } from "../../core/gameStore"

/**
 * Heads-Up Display (Sprint 5 reorganizado).
 *
 * Layout final:
 *   - Top-left: contador resumen de pociones + basura.
 *     (Se sigue pudiendo abrir/cerrar el inventario completo, pero
 *      ahora con la tecla `I`, no con click. Ver InventoryModal.)
 *   - Justo debajo (top-32 left-4): la PotionHotbar (renderizada por la escena).
 *   - Top-right: pista de controles.
 *
 * Las barras de vida (jugador / jefe) las pinta cada escena por
 * separado, no este HUD, porque solo aparecen en mazmorra.
 */
export function HUD() {
  const inventory = useGameStore((s) => s.inventory)
  const trash = useGameStore((s) => s.trashCount)
  const openInventory = useGameStore((s) => s.openInventory)

  const totalPotions = useMemo(
    () => Object.values(inventory).reduce((sum, n) => sum + (n ?? 0), 0),
    [inventory],
  )

  return (
    <>
      {/* Inventario / contadores (solo el resumen, el detalle vive en InventoryModal) */}
      <div className="pointer-events-auto absolute left-4 top-4 z-30 flex flex-col gap-2">
        <button
          onClick={openInventory}
          aria-label="Abrir inventario completo (tecla I)"
          className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:border-primary/60 hover:bg-background/90"
        >
          <GiPotionBall className="text-primary" size={20} />
          <span className="font-mono">{totalPotions}</span>
          <span className="text-muted-foreground">pociones</span>
          {trash > 0 && (
            <>
              <span className="mx-1 h-3 w-px bg-border" aria-hidden />
              <GiTrashCan className="text-destructive" size={18} />
              <span className="font-mono text-destructive">{trash}</span>
            </>
          )}
          <span className="ml-1 rounded bg-muted px-1 text-[10px] font-mono text-foreground">
            I
          </span>
        </button>
      </div>

      {/* Pista de controles */}
      <div className="pointer-events-none absolute right-4 top-4 z-30 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
        <p>
          <kbd className="rounded bg-muted px-1 text-foreground">WASD</kbd> moverse
        </p>
        <p>
          <kbd className="rounded bg-muted px-1 text-foreground">E</kbd> interactuar
        </p>
        <p>
          <kbd className="rounded bg-muted px-1 text-foreground">Tab</kbd>{" "}
          <kbd className="rounded bg-muted px-1 text-foreground">↑↓</kbd> hotbar
        </p>
        <p>
          <kbd className="rounded bg-muted px-1 text-foreground">Q</kbd> usar pocion
        </p>
        <p>
          <kbd className="rounded bg-muted px-1 text-foreground">J</kbd> atacar
        </p>
        <p>
          <kbd className="rounded bg-muted px-1 text-foreground">I</kbd> inventario
        </p>
      </div>
    </>
  )
}
