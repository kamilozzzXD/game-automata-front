import { useEffect } from "react"
import { HOTBAR_SLOTS, useGameStore } from "../core/gameStore"
import type { PotionId } from "../types/game"

type Options = {
  /** Permite pausar las teclas (modal abierto, generando mazmorra, etc). */
  enabled: boolean
  /** Callback que dispara la escena cuando el jugador "usa" una pocion. */
  onUsePotion: (id: PotionId) => void
  /** Si es false, impide consumir pociones (ej: en el claro del bosque). */
  allowUse?: boolean
}

/**
 * Hook centralizado para los controles del hotbar (Sprint 4 - Tarea 1 y 2).
 *
 *   - Tab / ArrowDown          -> cycleHotbar(+1)
 *   - Shift+Tab / ArrowUp      -> cycleHotbar(-1)
 *   - 1..9 / 0                 -> seleccion directa de slot
 *   - Q                        -> consumir pocion seleccionada y notificar
 *
 * IMPORTANTE: prevenimos el default de Tab/flechas para que el navegador
 * no robe el foco ni haga scroll mientras se juega.
 */
export function useHotbarControls({ enabled, onUsePotion, allowUse = true }: Options) {
  const cycleHotbar = useGameStore((s) => s.cycleHotbar)
  const setSelectedIndex = useGameStore((s) => s.setSelectedHotbarIndex)
  const consumeSelectedPotion = useGameStore((s) => s.consumeSelectedPotion)

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      const key = e.key

      // Cycling
      if (key === "Tab") {
        e.preventDefault()
        cycleHotbar(e.shiftKey ? -1 : 1)
        return
      }

      // Direct selection con teclado numerico (1..9 -> slots 0..8, 0 -> slot 9)
      if (/^[0-9]$/.test(key)) {
        const n = Number(key)
        const idx = n === 0 ? 9 : n - 1
        if (idx < HOTBAR_SLOTS.length) {
          setSelectedIndex(idx)
        }
        return
      }

      // Use selected potion
      if (key.toLowerCase() === "q") {
        e.preventDefault()
        if (!allowUse) {
          useGameStore.getState().pushNotification({
            kind: "info",
            message: "Solo puedes usar pociones dentro de la Mazmorra.",
          })
          return
        }
        const consumed = consumeSelectedPotion()
        if (consumed) onUsePotion(consumed)
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [enabled, cycleHotbar, setSelectedIndex, consumeSelectedPotion, onUsePotion, allowUse])
}
