import { useEffect, useState } from "react"
import {
  GiCauldron,
  GiCrystalGrowth,
  GiFire,
  GiHerbsBundle,
  GiMushroomGills,
  GiPotionBall,
  GiTrashCan,
  GiWaterDrop,
} from "react-icons/gi"
import type { IconType } from "react-icons"
import { useGameStore } from "../../core/gameStore"
import {
  INGREDIENT_NAMES,
  POTION_COLORS,
  POTION_NAMES,
  describeCauldronState,
  isSuccessfulPotion,
} from "../../core/dictionary"
import { craft } from "../../services/api"
import type { Ingredient, PotionId } from "../../types/game"

type IngredientButton = {
  id: Ingredient
  Icon: IconType
  color: string
}

const INGREDIENTS: IngredientButton[] = [
  { id: "A", Icon: GiWaterDrop, color: "text-sky-300" },
  { id: "B", Icon: GiHerbsBundle, color: "text-emerald-300" },
  { id: "C", Icon: GiMushroomGills, color: "text-amber-300" },
  { id: "D", Icon: GiFire, color: "text-orange-400" },
  { id: "E", Icon: GiCrystalGrowth, color: "text-fuchsia-300" },
]

// Visual feedback que dura un instante antes de volver al estado neutral del caldero.
type FlashKind = "success" | "trash" | null
const FLASH_DURATION_MS = 1200

export function CraftingModal() {
  const isOpen = useGameStore((s) => s.isCraftingOpen)
  const close = useGameStore((s) => s.closeCrafting)

  const automatonState = useGameStore((s) => s.automatonState)
  const ingredientHistory = useGameStore((s) => s.ingredientHistory)
  const isCrafting = useGameStore((s) => s.isCrafting)

  const setAutomatonState = useGameStore((s) => s.setAutomatonState)
  const pushIngredient = useGameStore((s) => s.pushIngredient)
  const setLastOutput = useGameStore((s) => s.setLastOutput)
  const setIsCrafting = useGameStore((s) => s.setIsCrafting)
  const clearTrail = useGameStore((s) => s.clearTrail)

  const addPotion = useGameStore((s) => s.addPotion)
  const addTrash = useGameStore((s) => s.addTrash)
  const pushNotification = useGameStore((s) => s.pushNotification)

  // Animacion temporal de exito / fracaso
  const [flash, setFlash] = useState<FlashKind>(null)
  const [lastPotionName, setLastPotionName] = useState<string | null>(null)
  // Sprint 5 - Tarea 1.B: guardamos la PotionId concreta para tintar la
  // animacion del caldero con el color hex unico de esa pocion. Si la
  // ultima salida fue P_basura, queda en null y caemos a un estilo gris.
  const [lastPotionId, setLastPotionId] = useState<PotionId | null>(null)

  // Cierra con ESC
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, close])

  // Limpia el flash automaticamente
  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), FLASH_DURATION_MS)
    return () => window.clearTimeout(t)
  }, [flash])

  const handleAddIngredient = async (ingredient: Ingredient) => {
    if (isCrafting) return

    setIsCrafting(true)
    // Registramos visualmente el ingrediente que el jugador eligio
    pushIngredient(ingredient)

    try {
      const res = await craft({
        estado_actual: automatonState,
        ingrediente: ingredient,
      })

      setAutomatonState(res.nuevo_estado)
      setLastOutput(res.salida)

      if (isSuccessfulPotion(res.salida)) {
        // Pocion exitosa: la sumamos al inventario
        addPotion(res.salida)
        setLastPotionName(POTION_NAMES[res.salida])
        setLastPotionId(res.salida)
        setFlash("success")
        pushNotification({ kind: "success", message: res.mensaje_ui })
      } else if (res.salida === "P_basura") {
        // Mezcla fallida: el backend ya nos resetea a q0
        addTrash()
        setLastPotionName(POTION_NAMES.P_basura)
        setLastPotionId(null)
        setFlash("trash")
        pushNotification({ kind: "error", message: res.mensaje_ui })
      } else {
        // Salida "-": aun mezclando, sin notificacion ruidosa
        pushNotification({ kind: "info", message: res.mensaje_ui })
      }

      // Si el backend devolvio q0, limpiamos el trail visual del caldero
      if (res.nuevo_estado === "q0") {
        // Pequeno retraso para que el jugador vea el ingrediente final antes de vaciarse
        window.setTimeout(() => clearTrail(), FLASH_DURATION_MS)
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

  if (!isOpen) return null

  const cauldronLabel = describeCauldronState(automatonState)

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
          {/* Caldero / estado visual */}
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl bg-muted/40 p-6">
            <div
              className={`relative flex h-40 w-40 items-center justify-center rounded-full transition-all ${
                flash === "trash"
                  ? "animate-shake"
                  : flash === "success"
                    ? "animate-pop"
                    : ""
              }`}
              // Sprint 5 - Tarea 1.B: el aro/halo del caldero adopta el color
              // hexadecimal unico de la pocion creada para que el feedback
              // visual sea inmediatamente reconocible. Cuando no hay flash o
              // el resultado fue P_basura, caemos al estilo neutral.
              style={{
                backgroundColor:
                  flash === "success" && lastPotionId
                    ? `${POTION_COLORS[lastPotionId]}33`
                    : flash === "trash"
                      ? "rgba(220, 38, 38, 0.2)"
                      : "rgba(100, 116, 139, 0.2)",
                boxShadow:
                  flash === "success" && lastPotionId
                    ? `0 0 0 4px ${POTION_COLORS[lastPotionId]}B3, 0 0 24px ${POTION_COLORS[lastPotionId]}66`
                    : flash === "trash"
                      ? "0 0 0 4px rgba(220, 38, 38, 0.6)"
                      : "0 0 0 2px rgba(100, 116, 139, 0.4)",
              }}
            >
              {flash === "success" ? (
                <GiPotionBall
                  size={96}
                  style={{
                    color: lastPotionId
                      ? POTION_COLORS[lastPotionId]
                      : "var(--primary)",
                    filter: lastPotionId
                      ? `drop-shadow(0 0 12px ${POTION_COLORS[lastPotionId]})`
                      : undefined,
                  }}
                />
              ) : flash === "trash" ? (
                <GiTrashCan className="text-destructive" size={96} />
              ) : (
                <GiCauldron className="text-foreground" size={96} />
              )}
            </div>

            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Estado del caldero
              </p>
              <p
                className={`text-lg font-bold ${
                  flash === "trash"
                    ? "text-destructive"
                    : flash === "success"
                      ? ""
                      : "text-foreground"
                }`}
                style={
                  flash === "success" && lastPotionId
                    ? { color: POTION_COLORS[lastPotionId] }
                    : undefined
                }
              >
                {flash && lastPotionName ? lastPotionName : cauldronLabel}
              </p>
            </div>

            {/* Trail de ingredientes (mostrados con su nombre amigable) */}
            <div className="flex min-h-[2rem] flex-wrap justify-center gap-1">
              {ingredientHistory.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Aun no has anadido ingredientes
                </span>
              ) : (
                ingredientHistory.map((ing, idx) => (
                  <span
                    key={idx}
                    className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                  >
                    {INGREDIENT_NAMES[ing]}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Ingredientes / acciones */}
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Selecciona un ingrediente para anadirlo al caldero. Las combinaciones
              correctas crearan pociones unicas.
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {INGREDIENTS.map(({ id, Icon, color }) => (
                <button
                  key={id}
                  onClick={() => handleAddIngredient(id)}
                  disabled={isCrafting}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-left transition-all hover:border-primary/60 hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon
                    className={`${color} transition-transform group-hover:scale-110`}
                    size={28}
                  />
                  <p className="font-semibold text-foreground">
                    {INGREDIENT_NAMES[id]}
                  </p>
                </button>
              ))}
            </div>

            {isCrafting && (
              <p className="text-center text-xs text-muted-foreground">
                La mezcla reacciona...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
