import { useEffect } from "react"
import { GiCrownedSkull } from "react-icons/gi"
import { useGameStore } from "../../core/gameStore"

/**
 * Tarea 3.3 - Barra de vida del Jefe.
 *
 * Diseño:
 *   - Barra de progreso grande en la parte superior de la pantalla.
 *   - Color rojo oscuro/carmesí.
 *   - A la derecha de la barra: dos iconos cuadrados pequeños que
 *     representan las "vidas" del jefe (desaparecen al perderlas).
 *   - Flash blanco de 100ms al recibir impacto.
 *
 * El jefe tiene 2 fases (bossLives = 2 al inicio). Cuando pierde la
 * primera barra se activa el Modo Furia y se rellena la barra.
 */
export function BossHealthBar() {
  const bossHp = useGameStore((s) => s.bossHp)
  const bossLives = useGameStore((s) => s.bossLives)
  const bossHealthFlash = useGameStore((s) => s.bossHealthFlash)
  const setBossHealthFlash = useGameStore((s) => s.setBossHealthFlash)
  const isBossFurious = useGameStore((s) => s.isBossFurious)

  // Apagar el flash después de 100ms
  useEffect(() => {
    if (!bossHealthFlash) return
    const timeout = window.setTimeout(() => {
      setBossHealthFlash(false)
    }, 100)
    return () => window.clearTimeout(timeout)
  }, [bossHealthFlash, setBossHealthFlash])

  // Si el jefe ya murió (bossLives === 0), no renderizamos la barra
  if (bossLives === 0) return null

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-3">
      {/* Contenedor de la barra con flash de impacto */}
      <div
        className={`flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 shadow-lg backdrop-blur transition-colors duration-75 ${
          bossHealthFlash
            ? "border-white bg-white/20"
            : isBossFurious
              ? "border-purple-500/70 bg-background/85"
              : "border-red-700/70 bg-background/85"
        }`}
      >
        {/* Icono del jefe */}
        <GiCrownedSkull
          className={`drop-shadow ${
            isBossFurious ? "text-purple-400" : "text-red-400"
          }`}
          size={24}
        />

        {/* Barra de HP */}
        <div className="relative h-5 w-48 overflow-hidden rounded-sm bg-red-950/80">
          <div
            className={`absolute inset-y-0 left-0 transition-all duration-150 ${
              isBossFurious
                ? "bg-gradient-to-r from-purple-600 to-purple-400"
                : "bg-gradient-to-r from-red-700 to-red-500"
            }`}
            style={{ width: `${bossHp}%` }}
          />
          {/* Texto de HP */}
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
            {bossHp} / 100
          </span>
        </div>
      </div>

      {/* Indicadores de vidas (cuadritos) */}
      <div className="flex gap-1">
        {/* Primera vida (siempre visible si bossLives >= 1) */}
        {bossLives >= 1 && (
          <div
            className={`h-5 w-5 rounded-sm border ${
              isBossFurious
                ? "border-purple-400/70 bg-purple-600"
                : "border-red-400/70 bg-red-600"
            }`}
            aria-label="Vida 1"
          />
        )}
        {/* Segunda vida (solo si bossLives === 2, desaparece en fase 2) */}
        {bossLives === 2 && (
          <div
            className="h-5 w-5 rounded-sm border border-red-400/70 bg-red-600"
            aria-label="Vida 2"
          />
        )}
      </div>
    </div>
  )
}
