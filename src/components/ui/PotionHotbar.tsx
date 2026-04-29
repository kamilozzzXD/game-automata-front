import { GiPotionBall } from "react-icons/gi"
import { HOTBAR_SLOTS, useGameStore } from "../../core/gameStore"
import { POTION_COLORS, POTION_NAMES } from "../../core/dictionary"

/**
 * Barra rapida de pociones (Sprint 4 + Sprint 5).
 *
 * Sprint 5 - Tarea 1.A: la barra se reubico al LADO IZQUIERDO de la
 * pantalla, justo debajo del bloque de inventario del HUD. Asi toda la
 * informacion de alquimia (pociones totales + slots rapidos) queda
 * concentrada en una sola zona visual.
 *
 * Sprint 5 - Tarea 1.B: cada slot ahora se tinge con el color hexadecimal
 * unico de la pocion (POTION_COLORS) en lugar de un icono uniforme.
 *
 * Sprint 5 - Tarea 1.B (nombre visible): debajo de la barra mostramos el
 * NOMBRE de la pocion seleccionada actualmente (no solo al hover) para
 * que ciclar con Tab sea informativo sin tener que mover el mouse.
 *
 * Posicionamiento: `top-32` deja espacio para el bloque de inventario
 * del HUD (que arranca en `top-4` con altura aprox. ~28px).
 */
export function PotionHotbar() {
  const inventory = useGameStore((s) => s.inventory)
  const selectedIndex = useGameStore((s) => s.selectedHotbarIndex)
  const setSelectedIndex = useGameStore((s) => s.setSelectedHotbarIndex)
  const isInvisible = useGameStore((s) => s.isPlayerInvisible)

  const selectedPotion = HOTBAR_SLOTS[selectedIndex]
  const selectedCount = inventory[selectedPotion] ?? 0

  return (
    <aside
      className="pointer-events-auto absolute left-4 top-32 z-30 select-none"
      aria-label="Barra rapida de pociones"
    >
      <div className="flex flex-col items-stretch gap-1.5 rounded-xl border border-border/60 bg-background/75 p-2 shadow-2xl backdrop-blur">
        <header className="px-1 pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pociones rapidas
        </header>

        {/* Lista de slots, uno por tipo de pocion */}
        <div className="flex flex-col gap-1.5">
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
                    ? "scale-105 border-accent ring-2 ring-accent shadow-[0_0_12px_rgba(56,189,248,0.4)]"
                    : "border-border/50 hover:border-border"
                } ${isEmpty ? "opacity-50" : "opacity-100"}`}
                style={{
                  // Fondo tintado con el color real de la pocion (alpha bajo
                  // si esta vacia, alto si esta llena y/o seleccionada).
                  backgroundColor: isEmpty
                    ? "rgba(75, 85, 99, 0.15)"
                    : `${color}33`,
                }}
              >
                {/* Numero del slot (esquina sup-izq) */}
                <span className="absolute left-1 top-0.5 text-[9px] font-bold text-muted-foreground">
                  {i + 1}
                </span>

                {/* Icono de la pocion teñido con el color real */}
                <GiPotionBall
                  size={26}
                  style={{
                    color: isEmpty ? "rgba(156, 163, 175, 0.7)" : color,
                    filter: isEmpty
                      ? undefined
                      : `drop-shadow(0 0 4px ${color}99)`,
                  }}
                />

                {/* Contador (esquina inf-der) */}
                {count > 0 && (
                  <span className="absolute bottom-0.5 right-1 rounded-sm bg-background/85 px-1 text-[10px] font-mono font-bold text-foreground">
                    x{count}
                  </span>
                )}

                {/* Tooltip al hover: nombre real (mostrado a la DERECHA porque
                    la barra ahora vive en el lado izquierdo) */}
                <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md border border-border/60 bg-background/95 px-2 py-1 text-xs text-foreground shadow group-hover:block">
                  {POTION_NAMES[potionId]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Nombre de la pocion seleccionada (visible siempre, no solo hover) */}
        <div
          className="mt-1 rounded-md border px-2 py-1 text-center"
          style={{
            borderColor: `${POTION_COLORS[selectedPotion]}80`,
            backgroundColor: `${POTION_COLORS[selectedPotion]}1A`,
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: POTION_COLORS[selectedPotion] }}
          >
            Seleccionada
          </p>
          <p
            className={`text-[11px] font-semibold leading-tight ${
              selectedCount > 0 ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {POTION_NAMES[selectedPotion]}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">
            x{selectedCount}
          </p>
        </div>

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
