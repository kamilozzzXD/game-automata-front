import { useEffect } from "react"
import { GiHealthNormal } from "react-icons/gi"
import { useGameStore } from "../../core/gameStore"

/**
 * Tarea 3.3 - Barra de vida del Jugador.
 *
 * Diseño:
 *   - Barra de progreso en la esquina inferior izquierda (sobre el HUD).
 *   - Color verde cuando HP > 30%, rojo cuando HP <= 30%.
 *   - Flash blanco de 100ms al recibir impacto.
 *
 * El jugador tiene 100 HP máximo. Puede curarse con:
 *   - P1 (Poción Menor de Curación): +25 HP
 *   - P5 (Poción de Curación Mayor): +50 HP
 *
 * La curación está acotada: Math.min(hp + curacion, 100).
 */
export function PlayerHealthBar() {
  const playerHp = useGameStore((s) => s.playerHp)
  const playerHealthFlash = useGameStore((s) => s.playerHealthFlash)
  const setPlayerHealthFlash = useGameStore((s) => s.setPlayerHealthFlash)

  // Apagar el flash después de 100ms
  useEffect(() => {
    if (!playerHealthFlash) return
    const timeout = window.setTimeout(() => {
      setPlayerHealthFlash(false)
    }, 100)
    return () => window.clearTimeout(timeout)
  }, [playerHealthFlash, setPlayerHealthFlash])

  // Determinar el color según el HP
  const isLowHp = playerHp <= 30
  const isDead = playerHp === 0

  return (
    <div className="pointer-events-none absolute right-4 bottom-4 z-40 flex items-center gap-2">
      {/* Contenedor con flash de impacto */}
      <div
        className={`flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 shadow-lg backdrop-blur transition-colors duration-75 ${
          playerHealthFlash
            ? "border-white bg-white/20"
            : isDead
              ? "border-red-800/70 bg-background/85"
              : isLowHp
                ? "border-red-500/70 bg-background/85"
                : "border-emerald-600/70 bg-background/85"
        }`}
      >
        {/* Icono de salud */}
        <GiHealthNormal
          className={`drop-shadow ${
            isDead
              ? "text-red-800"
              : isLowHp
                ? "text-red-400 animate-pulse"
                : "text-emerald-400"
          }`}
          size={20}
        />

        {/* Barra de HP */}
        <div className="relative h-4 w-32 overflow-hidden rounded-sm bg-slate-800/80">
          <div
            className={`absolute inset-y-0 left-0 transition-all duration-150 ${
              isDead
                ? "bg-red-900"
                : isLowHp
                  ? "bg-gradient-to-r from-red-600 to-red-400"
                  : "bg-gradient-to-r from-emerald-600 to-emerald-400"
            }`}
            style={{ width: `${playerHp}%` }}
          />
          {/* Texto de HP */}
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">
            {playerHp} / 100
          </span>
        </div>
      </div>

      {/* Indicador de estado crítico */}
      {isLowHp && !isDead && (
        <span className="rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white animate-pulse">
          PELIGRO
        </span>
      )}
      {isDead && (
        <span className="rounded bg-red-900/90 px-1.5 py-0.5 text-[10px] font-bold text-red-200">
          MUERTO
        </span>
      )}
    </div>
  )
}
