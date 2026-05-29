import { useEffect, useMemo, useState } from "react"
import { GiPotionBall, GiTrashCan, GiChest, GiWaterDrop, GiHerbsBundle, GiMushroomGills, GiFire, GiCrystalGrowth } from "react-icons/gi"
import { useGameStore } from "../../core/gameStore"
import { POTION_COLORS, POTION_NAMES, INGREDIENT_NAMES } from "../../core/dictionary"
import type { PotionId, Ingredient } from "../../types/game"
import { PotionHotbar } from "./PotionHotbar"
import { ActiveEffects } from "./ActiveEffects"

const INGREDIENTS_UI: { id: Ingredient; Icon: React.ElementType; color: string }[] = [
  { id: "A", Icon: GiWaterDrop, color: "text-sky-300" },
  { id: "B", Icon: GiHerbsBundle, color: "text-emerald-300" },
  { id: "C", Icon: GiMushroomGills, color: "text-amber-300" },
  { id: "D", Icon: GiFire, color: "text-orange-400" },
  { id: "E", Icon: GiCrystalGrowth, color: "text-fuchsia-300" },
]

const POTION_ORDER: PotionId[] = [
  "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10",
]

export function HUD() {
  const inventory = useGameStore((s) => s.inventory)
  const ingredientInventory = useGameStore((s) => s.ingredientInventory)
  const trash = useGameStore((s) => s.trashCount)
  const [open, setOpen] = useState(false)
  const [openIngredients, setOpenIngredients] = useState(false)

  const totalPotions = useMemo(
    () => Object.values(inventory).reduce((sum, n) => sum + (n ?? 0), 0),
    [inventory],
  )
  
  const totalIngredients = useMemo(
    () => Object.values(ingredientInventory).reduce((sum, n) => sum + (n ?? 0), 0),
    [ingredientInventory],
  )

  const ownedPotions = POTION_ORDER.filter((id) => (inventory[id] ?? 0) > 0)
  const ownedIngredients = INGREDIENTS_UI.filter(({id}) => (ingredientInventory[id] ?? 0) > 0)

  // Tecla "I" para abrir/cerrar el inventario
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

  // Tecla "O" para abrir/cerrar el inventario de ingredientes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "o") return
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
      setOpenIngredients((v) => !v)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <>
      {/* Bloque izquierdo: contadores + hotbar */}
      <div className="pointer-events-auto absolute left-4 top-4 z-30 flex flex-col gap-2">
        
        {/* Fila de Inventarios */}
        <div className="flex items-start gap-2">
          
          {/* Columna Pociones -> Añadido 'relative' para contener el desplegable absoluto */}
          <div className="relative flex flex-col gap-2">
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

            {/* Ajustado a absolute, z-40 y fondo más traslúcido bg-background/75 */}
            {open && (
              <div className="absolute top-full left-0 z-40 mt-1.5 w-64 rounded-lg border border-border/60 bg-background/75 p-3 text-sm shadow-xl backdrop-blur">
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
          </div>

          {/* Columna Ingredientes -> Añadido 'relative' para contener el desplegable absoluto */}
          <div className="relative flex flex-col gap-2">
            <button
              onClick={() => setOpenIngredients((v) => !v)}
              aria-expanded={openIngredients}
              aria-label="Abrir ingredientes (tecla O)"
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:border-primary/60 hover:bg-background/90"
            >
              <GiChest className="text-primary" size={20} />
              <span className="font-mono">{totalIngredients}</span>
              <span className="text-muted-foreground">materiales</span>
              <kbd className="ml-1 rounded bg-muted px-1 text-[10px] font-mono text-foreground">
                O
              </kbd>
            </button>

            {/* Ajustado a absolute, z-40 y fondo más traslúcido bg-background/75 */}
            {openIngredients && (
              <div className="absolute top-full left-0 z-40 mt-1.5 w-64 rounded-lg border border-border/60 bg-background/75 p-3 text-sm shadow-xl backdrop-blur">
                <p className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
                  <span>Materiales Mágicos</span>
                  <kbd className="rounded bg-muted px-1 text-[10px] text-foreground">
                    O
                  </kbd>
                </p>
                {ownedIngredients.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aun no has recolectado materiales.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {ownedIngredients.map(({id, Icon, color}) => (
                      <li
                        key={id}
                        className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-foreground"
                      >
                        <span className="flex items-center gap-2">
                          <Icon className={color} size={16} />
                          <span className={`text-xs font-medium ${color}`}>
                            {INGREDIENT_NAMES[id]}
                          </span>
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          x{ingredientInventory[id]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Barra rápida de pociones: Ahora se quedará fija aquí arriba */}
        <PotionHotbar />
      </div>

      {/* Controles */}
      <div className="pointer-events-none absolute right-4 top-4 z-30 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
        <p><kbd className="rounded bg-muted px-1 text-foreground">WASD</kbd> moverse</p>
        <p><kbd className="rounded bg-muted px-1 text-foreground">E</kbd> interactuar</p>
        <p><kbd className="rounded bg-muted px-1 text-foreground">I</kbd> pociones</p>
        <p><kbd className="rounded bg-muted px-1 text-foreground">O</kbd> materiales</p>
        <p><kbd className="rounded bg-muted px-1 text-foreground">Tab</kbd> <kbd className="rounded bg-muted px-1 text-foreground">↑↓</kbd> hotbar</p>
        <p><kbd className="rounded bg-muted px-1 text-foreground">Q</kbd> usar pocion</p>
        <p><kbd className="rounded bg-muted px-1 text-foreground">J</kbd> disparar</p>
      </div>

      <ActiveEffects />
    </>
  )
}