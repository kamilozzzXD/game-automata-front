import { useEffect } from "react"
import {
  GiBrokenSkull,
  GiCauldron,
  GiCrystalGrowth,
  GiHerbsBundle,
  GiPotionBall,
  GiWaterDrop,
} from "react-icons/gi"
import { useGameStore } from "../../core/gameStore"
import { craft } from "../../services/api"
import type { Ingredient } from "../../types/game"

const INGREDIENTS: Array<{
  id: Ingredient
  name: string
  Icon: typeof GiWaterDrop
  color: string
}> = [
  { id: "A", name: "Agua", Icon: GiWaterDrop, color: "text-sky-300" },
  { id: "B", name: "Hierba", Icon: GiHerbsBundle, color: "text-emerald-300" },
  { id: "C", name: "Cristal", Icon: GiCrystalGrowth, color: "text-fuchsia-300" },
]

export function CraftingModal() {
  const isOpen = useGameStore((s) => s.isCraftingOpen)
  const close = useGameStore((s) => s.closeCrafting)

  const automatonState = useGameStore((s) => s.automatonState)
  const ingredientHistory = useGameStore((s) => s.ingredientHistory)
  const lastOutput = useGameStore((s) => s.lastOutput)
  const isCrafting = useGameStore((s) => s.isCrafting)

  const setAutomatonState = useGameStore((s) => s.setAutomatonState)
  const pushIngredient = useGameStore((s) => s.pushIngredient)
  const setLastOutput = useGameStore((s) => s.setLastOutput)
  const setIsCrafting = useGameStore((s) => s.setIsCrafting)
  const resetCauldron = useGameStore((s) => s.resetCauldron)

  const addPotion = useGameStore((s) => s.addPotion)
  const pushNotification = useGameStore((s) => s.pushNotification)

  // Cierra con ESC
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, close])

  const isError = automatonState === "q_error"
  const isVictory = lastOutput === "P"

  const handleAddIngredient = async (ingredient: Ingredient) => {
    if (isCrafting || isError || isVictory) return

    setIsCrafting(true)
    try {
      const res = await craft({ estado: automatonState, ingrediente: ingredient })
      pushIngredient(ingredient)
      setAutomatonState(res.estado)
      setLastOutput(res.salida)

      if (res.salida === "P") {
        addPotion()
        pushNotification({ kind: "success", message: "Pocion creada con exito!" })
      } else if (res.estado === "q_error") {
        pushNotification({ kind: "error", message: "La mezcla fallo. Limpia el caldero." })
      }
    } catch (err) {
      console.error("[v0] Error en /api/craft", err)
      pushNotification({
        kind: "error",
        message: "No se pudo conectar al servidor del juego.",
      })
    } finally {
      setIsCrafting(false)
    }
  }

  const handleReset = () => {
    resetCauldron()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crafting-title"
    >
      <div className="relative w-full max-w-2xl rounded-2xl border border-primary/30 bg-card text-card-foreground shadow-2xl shadow-primary/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <GiCauldron className="text-primary" size={28} />
            <h2 id="crafting-title" className="text-xl font-bold text-foreground">
              Caldero de Alquimia
            </h2>
          </div>
          <button
            onClick={close}
            className="rounded-md px-3 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Cerrar (Esc)
          </button>
        </div>

        {/* Body */}
        <div className="grid gap-6 p-6 md:grid-cols-2">
          {/* Caldero / estado */}
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl bg-muted/40 p-6">
            <div
              className={`relative flex h-40 w-40 items-center justify-center rounded-full transition-all ${
                isError
                  ? "bg-destructive/20 ring-4 ring-destructive/60 animate-shake"
                  : isVictory
                    ? "bg-primary/20 ring-4 ring-primary/70 animate-pop"
                    : "bg-secondary/40 ring-2 ring-border"
              }`}
            >
              {isVictory ? (
                <GiPotionBall className="text-primary" size={96} />
              ) : isError ? (
                <GiBrokenSkull className="text-destructive" size={96} />
              ) : (
                <GiCauldron className="text-foreground" size={96} />
              )}
            </div>

            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Estado actual
              </p>
              <p
                className={`font-mono text-lg font-bold ${
                  isError
                    ? "text-destructive"
                    : isVictory
                      ? "text-primary"
                      : "text-foreground"
                }`}
              >
                {automatonState}
              </p>
            </div>

            {/* Trail de ingredientes */}
            <div className="flex min-h-[2rem] flex-wrap justify-center gap-1">
              {ingredientHistory.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Aun no has agregado ingredientes
                </span>
              ) : (
                ingredientHistory.map((ing, idx) => (
                  <span
                    key={idx}
                    className="rounded bg-secondary px-2 py-0.5 text-xs font-mono text-secondary-foreground"
                  >
                    {ing}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Ingredientes / acciones */}
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Selecciona un ingrediente para anadirlo al caldero. Cada eleccion modifica
              el estado del automata.
            </p>

            <div className="flex flex-col gap-2">
              {INGREDIENTS.map(({ id, name, Icon, color }) => (
                <button
                  key={id}
                  onClick={() => handleAddIngredient(id)}
                  disabled={isCrafting || isError || isVictory}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3 text-left transition-all hover:border-primary/60 hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon className={`${color} transition-transform group-hover:scale-110`} size={32} />
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">Ingrediente {id}</p>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">[{id}]</span>
                </button>
              ))}
            </div>

            {(isError || isVictory) && (
              <button
                onClick={handleReset}
                className="mt-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
              >
                Limpiar caldero
              </button>
            )}

            {!isError && !isVictory && ingredientHistory.length > 0 && (
              <button
                onClick={handleReset}
                className="mt-2 rounded-lg border border-border bg-transparent px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Vaciar caldero
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
