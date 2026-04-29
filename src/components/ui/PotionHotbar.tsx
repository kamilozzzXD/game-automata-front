import { GiPotionBall } from "react-icons/gi"
import { HOTBAR_SLOTS, useGameStore } from "../../core/gameStore"
import { POTION_NAMES } from "../../core/dictionary"

/**
 * Barra de acceso rapido vertical (Sprint 4 - Tarea 1).
 *
 * Estilo Minecraft/Terraria pero rotada: 10 casillas apiladas en el
 * lateral derecho, una por tipo de pocion (P1..P10). El slot
 * seleccionado se resalta con borde marcado y leve escala.
 *
 * Controles (sin raton):
 *   - Tab / FlechaAbajo  -> baja la seleccion (cicla)
 *   - ShiftTab / FlechaArriba -> sube la seleccion (cicla)
 *   - Q                  -> consume la pocion seleccionada
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
    <aside
      className="pointer-events-auto absolute right-3 top-1/2 z-30 -translate-y-1/2 select-none"
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

          return (
            <button
              key={potionId}
              type="button"
              onClick={() => setSelectedIndex(i)}
              aria-label={`Slot ${i + 1}: ${POTION_NAMES[potionId]} (${count})`}
              aria-pressed={isSelected}
              className={`group relative flex h-12 w-12 items-center justify-center rounded-md border transition-all ${
                isSelected
                  ? "scale-105 border-accent bg-accent/15 ring-2 ring-accent shadow-[0_0_12px_rgba(56,189,248,0.4)]"
                  : "border-border/50 bg-background/50 hover:border-border"
              } ${isEmpty ? "opacity-40" : "opacity-100"}`}
            >
              {/* Numero del slot (esquina sup-izq) */}
              <span className="absolute left-1 top-0.5 text-[9px] font-bold text-muted-foreground">
                {i + 1}
              </span>

              {/* Icono de la pocion (color depende de si esta vacia o no) */}
              <GiPotionBall
                className={`${
                  isEmpty
                    ? "text-muted-foreground/60"
                    : isSelected
                      ? "text-accent"
                      : "text-primary"
                }`}
                size={26}
              />

              {/* Contador (esquina inf-der) */}
              {count > 0 && (
                <span className="absolute bottom-0.5 right-1 rounded-sm bg-background/80 px-1 text-[10px] font-mono font-bold text-foreground">
                  x{count}
                </span>
              )}

              {/* Tooltip al hover: nombre real */}
              <span className="pointer-events-none absolute right-full mr-2 hidden whitespace-nowrap rounded-md border border-border/60 bg-background/95 px-2 py-1 text-xs text-foreground shadow group-hover:block">
                {POTION_NAMES[potionId]}
              </span>
            </button>
          )
        })}

        {/* Pista de controles */}
        <footer className="mt-1 border-t border-border/40 pt-1.5 text-center text-[9px] leading-tight text-muted-foreground">
          <p>
            <kbd className="rounded bg-muted px-1 text-foreground">Tab</kbd>{" "}
            <kbd className="rounded bg-muted px-1 text-foreground">↑↓</kbd>
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
