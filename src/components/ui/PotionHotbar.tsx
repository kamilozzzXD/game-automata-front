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
 * Sprint Polish-Pass - Tarea 3: ya no es indispensable usar el raton.
 * Mostramos el nombre de la pocion actualmente seleccionada en un
 * cuadro de texto debajo de la barra para feedback al cyclar con Tab.
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

  const selectedPotionId = HOTBAR_SLOTS[selectedIndex]
  const selectedColor = POTION_COLORS[selectedPotionId]
  const selectedCount = inventory[selectedPotionId] ?? 0

  return (
    <aside
      className="pointer-events-auto select-none"
      aria-label="Barra rapida de pociones"
    >
      <div className="flex flex-col items-stretch gap-1.5 rounded-xl border border-border/60 bg-background/75 p-2 shadow-2xl backdrop-blur">
        <header className="px-1 pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pociones
        </header>

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
              className={`group relative flex h-12 w-12 items-center justify-center rounded-md border transition-all ${
                isSelected
                  ? "scale-105 bg-background/80"
                  : "border-border/50 bg-background/50 hover:border-border"
              } ${isEmpty ? "opacity-40" : "opacity-100"}`}
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

        {/* Cuadro de dialogo con la pocion actualmente seleccionada
            (Sprint Polish-Pass - Tarea 3). Se actualiza en cada Tab
            para que el jugador siempre sepa que tiene activo. */}
        <div
          className="mt-1 rounded-md border border-border/50 bg-background/85 px-2 py-1.5 text-center"
          aria-live="polite"
        >
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Seleccionada
          </p>
          <p
            className={`text-[11px] font-bold leading-tight ${selectedColor.text}`}
          >
            {POTION_NAMES[selectedPotionId]}
          </p>
          <p className="text-[9px] font-mono text-muted-foreground">
            {selectedCount > 0 ? `x${selectedCount}` : "(vacio)"}
          </p>
        </div>

        {/* Pista de controles */}
        <footer className="border-t border-border/40 pt-1.5 text-center text-[9px] leading-tight text-muted-foreground">
          <p>
            <kbd className="rounded bg-muted px-1 text-foreground">Tab</kbd>{" "}
            <kbd className="rounded bg-muted px-1 text-foreground">↑↓</kbd>{" "}
            cambiar
          </p>
          <p>
            <kbd className="rounded bg-muted px-1 text-foreground">Q</kbd> usar
          </p>
        </footer>

        {/* Indicador "INVISIBLE ACTIVO" cuando aplica */}
        {isInvisible && (
          <div
            className="mt-1 rounded-md border border-cyan-400/60 bg-cyan-400/10 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-cyan-300 animate-pulse"
            aria-live="polite"
          >
            Invisible
          </div>
        )}
      </div>
    </aside>
  )
}
