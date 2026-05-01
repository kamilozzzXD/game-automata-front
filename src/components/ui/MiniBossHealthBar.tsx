import { useEffect } from "react"
import { GiGhost } from "react-icons/gi"
import { useGameStore } from "../../core/gameStore"

/**
 * Barra de vida del Mini-Boss en las salas secretas.
 * Muestra 50 HP máximo.
 */
export function MiniBossHealthBar() {
  const miniBossHp = useGameStore((s) => s.miniBossHp)
  const bossHealthFlash = useGameStore((s) => s.bossHealthFlash)
  const setBossHealthFlash = useGameStore((s) => s.setBossHealthFlash)

  // Apagar el flash después de 100ms
  useEffect(() => {
    if (!bossHealthFlash) return
    const timeout = window.setTimeout(() => {
      setBossHealthFlash(false)
    }, 100)
    return () => window.clearTimeout(timeout)
  }, [bossHealthFlash, setBossHealthFlash])

  // Si ya murió (miniBossHp <= 0), no renderizamos la barra
  if (miniBossHp <= 0) return null

  // Porcentaje de vida (0-100) respecto al máximo (50)
  const hpPercent = (miniBossHp / 50) * 100

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-3">
      {/* Contenedor de la barra con flash de impacto */}
      <div
        className={`flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 shadow-lg backdrop-blur transition-colors duration-75 ${
          bossHealthFlash
            ? "border-white bg-white/20"
            : "border-indigo-700/70 bg-background/85"
        }`}
      >
        {/* Icono del mini jefe */}
        <GiGhost
          className="drop-shadow text-indigo-400"
          size={24}
        />

        {/* Barra de HP */}
        <div className="relative h-5 w-48 overflow-hidden rounded-sm bg-indigo-950/80">
          <div
            className="absolute inset-y-0 left-0 transition-all duration-150 bg-gradient-to-r from-indigo-700 to-indigo-500"
            style={{ width: `${hpPercent}%` }}
          />
          {/* Texto de HP */}
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
            {miniBossHp} / 50
          </span>
        </div>
      </div>
    </div>
  )
}
