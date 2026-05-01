import { GiPotionBall } from "react-icons/gi"
import { HOTBAR_SLOTS, useGameStore } from "../../core/gameStore"
import { POTION_COLORS, POTION_NAMES } from "../../core/dictionary"

/**
 * Barra de acceso rapido vertical (Sprint 4 - Tarea 1, ajustada en
 * Sprint Polish-Pass - Tarea 1).
 *
 * Reubicacion: ahora se renderiza dentro del HUD (columna izquierda),
 * justo debajo del bloque "X pociones / basura Y". Por eso ya no usa
 * `absolute`: se apila naturalmente con el resto del HUD via flex.
 *
 * Sprint Polish-Pass - Tarea 2: cada slot toma el color del POTION_COLORS
 * para que el jugador identifique pociones de un solo vistazo (sin
 * pasar el raton por encima).
 *
 * Sprint Polish-Pass v3 - Ticket UI: el panel oscuro que envolvia a
 * los 10 slots se elimina por completo (estorbaba la vision del juego),
 * y la tarjeta "Seleccionada" tambien se retira. Cada slot vive como
 * una tarjeta flotante independiente, dejando ver la escena detras.
 *
 * Controles (sin raton):
 *   - Tab / FlechaAbajo  -> baja la seleccion (cicla)
 *   - ShiftTab / FlechaArriba -> sube la seleccion (cicla)
 *   - Q                  -> consume la pocion seleccionada
 *   - 1..9 / 0           -> seleccion directa (vivo en useHotbarControls)
 *
 * NO renderiza handlers de teclado: la lectura de teclas vive en el
 * hook useHotbarControls que la escena monta una sola vez.
 */
export function PotionHotbar() {
  const inventory = useGameStore((s) => s.inventory)
  const selectedIndex = useGameStore((s) => s.selectedHotbarIndex)
  const setSelectedIndex = useGameStore((s) => s.setSelectedHotbarIndex)
  const isInvisible = useGameStore((s) => s.isPlayerInvisible)

  return (
    // Sprint Polish-Pass v3 - Ticket UI:
    //   - Sin panel oscuro de fondo (no obstaculiza la vision).
    //   - Sin tarjeta "Seleccionada".
    //   - Cada slot es una tarjeta flotante independiente.
    //   - Se conserva el indicador "Invisible" porque es feedback critico
    //     para el jugador y solo aparece de forma puntual.
    <aside
      className="pointer-events-auto flex select-none flex-col gap-1.5"
      aria-label="Barra rapida de pociones"
    >
      {HOTBAR_SLOTS.map((potionId, i) => {
        const count = inventory[potionId] ?? 0
        const isSelected = i === selectedIndex
        const isEmpty = count <= 0
        const color = POTION_COLORS[potionId]

        return (
          <button
            key={potionId}
            type="button"
            onClick={() => setSelectedIndex(i)}
            aria-label={`Slot ${i + 1}: ${POTION_NAMES[potionId]} (${count})`}
            aria-pressed={isSelected}
            className={`group relative flex h-12 w-12 items-center justify-center rounded-md border shadow-lg backdrop-blur transition-all ${
              isSelected
                ? "scale-105 bg-background/80"
                : "border-border/60 bg-background/70 hover:border-border"
            } ${isEmpty ? "opacity-50" : "opacity-100"}`}
            style={
              isSelected
                ? {
                    borderColor: color.glow.replace("0.55", "0.9"),
                    boxShadow: `0 0 14px ${color.glow}`,
                  }
                : undefined
            }
          >
            {/* Numero del slot (esquina sup-izq) */}
            <span className="absolute left-1 top-0.5 text-[9px] font-bold text-muted-foreground">
              {i + 1}
            </span>

            {/* Icono de la pocion (color depende del tipo y de si esta vacia) */}
            <GiPotionBall
              className={`${
                isEmpty ? "text-muted-foreground/60" : color.text
              }`}
              size={26}
            />

            {/* Contador (esquina inf-der) */}
            {count > 0 && (
              <span className="absolute bottom-0.5 right-1 rounded-sm bg-background/80 px-1 text-[10px] font-mono font-bold text-foreground">
                x{count}
              </span>
            )}
          </button>
        )
      })}
    </aside>
  )
}
