import { useEffect, useMemo, useState } from "react"
import { GiPotionBall, GiTrashCan } from "react-icons/gi"
import { useGameStore } from "../../core/gameStore"
import { POTION_COLORS, POTION_NAMES } from "../../core/dictionary"
import type { PotionId } from "../../types/game"
import { PotionHotbar } from "./PotionHotbar"

const POTION_ORDER: PotionId[] = [
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
  "P9",
  "P10",
]

/**
 * Heads-Up Display: muestra inventario y controles superpuestos sobre la escena.
 *
 * Sprint Polish-Pass:
 *   - Tarea 1: el HUD ahora monta a la PotionHotbar dentro de la misma
 *     columna izquierda, justo debajo del bloque "X pociones / basura Y".
 *     Asi toda la informacion secuencial de pociones queda agrupada.
 *   - Tarea 2: cada pocion del inventario abierto se renderiza con su
 *     color caracteristico (POTION_COLORS) para identificarlas de un
 *     vistazo, sin pasar el raton por encima.
 *   - Tarea 3 (Accion 1): el bloque del inventario ya NO depende del
 *     raton. Se abre/cierra con la tecla "I" (toggle). El boton sigue
 *     siendo cliqueable como respaldo, pero no es la via principal.
 */
export function HUD() {
  const inventory = useGameStore((s) => s.inventory)
  const trash = useGameStore((s) => s.trashCount)
  const [open, setOpen] = useState(false)

  const totalPotions = useMemo(
    () => Object.values(inventory).reduce((sum, n) => sum + (n ?? 0), 0),
    [inventory],
  )

  const ownedPotions = POTION_ORDER.filter((id) => (inventory[id] ?? 0) > 0)

  // Tecla "I" para abrir/cerrar el inventario (Sprint Polish-Pass - Tarea 3.1).
  // Ignoramos la tecla cuando el usuario esta tipeando en un input/textarea
  // (defensa contra futuros campos de texto).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "i") return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return
      }
      e.preventDefault()
      setOpen((v) => !v)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <>
      {/* Bloque izquierdo: contadores + hotbar.
          Posicion absoluta dentro del contenedor relativo de la escena. */}
      <div className="pointer-events-auto absolute left-4 top-4 z-30 flex flex-col gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Abrir inventario (tecla I)"
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
          <kbd className="ml-1 rounded bg-muted px-1 text-[10px] font-mono text-foreground">
            I
          </kbd>
        </button>

        {open && (
          <div className="w-64 rounded-lg border border-border/60 bg-background/90 p-3 text-sm shadow-xl backdrop-blur">
            <p className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
              <span>Inventario</span>
              <kbd className="rounded bg-muted px-1 text-[10px] text-foreground">
                I
              </kbd>
            </p>
            {ownedPotions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aun no has creado pociones.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {ownedPotions.map((id) => {
                  const color = POTION_COLORS[id]
                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-foreground"
                    >
                      <span className="flex items-center gap-2">
                        <GiPotionBall className={color.text} size={16} />
                        <span className={`text-xs font-medium ${color.text}`}>
                          {POTION_NAMES[id]}
                        </span>
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        x{inventory[id]}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            {trash > 0 && (
              <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                <span className="flex items-center gap-2 text-destructive">
                  <GiTrashCan size={14} />
                  Pociones basura
                </span>
                <span className="font-mono text-destructive">x{trash}</span>
              </div>
            )}
          </div>
        )}

        {/* Barra rapida vertical (Sprint Polish-Pass - Tarea 1):
            queda apilada justo debajo del bloque de info de pociones. */}
        <PotionHotbar />
      </div>

      {/* Controles */}
      <div className="pointer-events-none absolute right-4 top-4 z-30 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
        <p>
          <kbd className="rounded bg-muted px-1 text-foreground">WASD</kbd> moverse
        </p>
        <p>
          <kbd className="rounded bg-muted px-1 text-foreground">E</kbd> interactuar
        </p>
        <p>
          <kbd className="rounded bg-muted px-1 text-foreground">I</kbd> inventario
        </p>
        <p>
          <kbd className="rounded bg-muted px-1 text-foreground">Tab</kbd>{" "}
          <kbd className="rounded bg-muted px-1 text-foreground">↑↓</kbd> hotbar
        </p>
        <p>
          <kbd className="rounded bg-muted px-1 text-foreground">Q</kbd> usar pocion
        </p>
        <p>
          <kbd className="rounded bg-muted px-1 text-foreground">J</kbd> disparar
        </p>
      </div>
    </>
  )
}
