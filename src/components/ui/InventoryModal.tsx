import { useEffect } from "react"
import { GiPotionBall, GiTrashCan } from "react-icons/gi"
import { POTION_COLORS, POTION_NAMES } from "../../core/dictionary"
import { HOTBAR_SLOTS, useGameStore } from "../../core/gameStore"

/**
 * Modal de inventario completo (Sprint 5 - Tarea 1.B).
 *
 * Se abre con la tecla `I` (no con click). Muestra TODAS las pociones
 * (P1..P10) con su color hexadecimal unico para que el jugador
 * identifique cada una de un vistazo. Las pociones que aun no se han
 * crafteado aparecen con opacidad reducida.
 */
export function InventoryModal() {
  const isOpen = useGameStore((s) => s.isInventoryOpen)
  const close = useGameStore((s) => s.closeInventory)
  const inventory = useGameStore((s) => s.inventory)
  const trash = useGameStore((s) => s.trashCount)

  // Cierra con ESC o I.
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key.toLowerCase() === "i") {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, close])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-primary/30 bg-card text-card-foreground shadow-2xl shadow-primary/10">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <GiPotionBall className="text-primary" size={22} />
            <h2 id="inventory-title" className="text-lg font-bold">
              Inventario completo
            </h2>
          </div>
          <button
            onClick={close}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Cerrar (Esc / I)
          </button>
        </div>

        <ul className="grid max-h-[60vh] grid-cols-1 gap-1.5 overflow-y-auto p-4 sm:grid-cols-2">
          {HOTBAR_SLOTS.map((id) => {
            const count = inventory[id] ?? 0
            const owned = count > 0
            const color = POTION_COLORS[id]
            return (
              <li
                key={id}
                className={`flex items-center gap-3 rounded-lg border p-2 transition-opacity ${
                  owned ? "opacity-100" : "opacity-50"
                }`}
                style={{
                  borderColor: `${color}66`,
                  backgroundColor: `${color}14`,
                }}
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${color}33` }}
                >
                  <GiPotionBall
                    size={26}
                    style={{
                      color,
                      filter: `drop-shadow(0 0 4px ${color}99)`,
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-xs font-semibold"
                    style={{ color }}
                  >
                    {POTION_NAMES[id]}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {owned ? `x${count}` : "no creada"}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>

        {trash > 0 && (
          <div className="flex items-center justify-between border-t border-border/60 px-5 py-2 text-xs">
            <span className="flex items-center gap-2 text-destructive">
              <GiTrashCan size={16} />
              Pociones basura
            </span>
            <span className="font-mono text-destructive">x{trash}</span>
          </div>
        )}
      </div>
    </div>
  )
}
