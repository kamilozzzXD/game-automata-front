import { useGameStore } from "../../core/gameStore"

/**
 * Panel de efectos activos de pociones.
 *
 * Se posiciona en la parte inferior-derecha de la pantalla de juego.
 * Muestra TODOS los buffs temporales activos simultáneamente como
 * tarjetas compactas apiladas verticalmente, cada una con su icono,
 * nombre corto y color distintivo. Desaparecen automáticamente
 * cuando el temporizador de cada efecto se agota.
 */

type ActiveBuff = {
  key: string
  label: string
  emoji: string
  borderColor: string
  bgColor: string
  textColor: string
}

export function ActiveEffects() {
  const isInvisible = useGameStore((s) => s.isPlayerInvisible)
  const isPotionAimActive = useGameStore((s) => s.isPotionAimActive)
  const isSpeedActive = useGameStore((s) => s.isSpeedActive)
  const isMultiShotActive = useGameStore((s) => s.isMultiShotActive)
  const isHyperReflexesActive = useGameStore((s) => s.isHyperReflexesActive)
  const isShieldActive = useGameStore((s) => s.isShieldActive)
  const isExtremeCadenceActive = useGameStore((s) => s.isExtremeCadenceActive)

  // Construimos la lista de buffs activos dinámicamente.
  const activeBuffs: ActiveBuff[] = []

  if (isInvisible) {
    activeBuffs.push({
      key: "invisible",
      label: "Invisible",
      emoji: "🫥",
      borderColor: "border-cyan-400/60",
      bgColor: "bg-cyan-400/10",
      textColor: "text-cyan-300",
    })
  }
  if (isPotionAimActive) {
    activeBuffs.push({
      key: "aim",
      label: "Puntería ×1.5",
      emoji: "🎯",
      borderColor: "border-amber-400/60",
      bgColor: "bg-amber-400/10",
      textColor: "text-amber-300",
    })
  }
  if (isSpeedActive) {
    activeBuffs.push({
      key: "speed",
      label: "Velocidad",
      emoji: "💨",
      borderColor: "border-green-400/60",
      bgColor: "bg-green-400/10",
      textColor: "text-green-300",
    })
  }
  if (isMultiShotActive) {
    activeBuffs.push({
      key: "multishot",
      label: "Triple Disparo",
      emoji: "🔱",
      borderColor: "border-violet-400/60",
      bgColor: "bg-violet-400/10",
      textColor: "text-violet-300",
    })
  }
  if (isHyperReflexesActive) {
    activeBuffs.push({
      key: "reflex",
      label: "Hiper-Reflejos",
      emoji: "⚡",
      borderColor: "border-blue-400/60",
      bgColor: "bg-blue-400/10",
      textColor: "text-blue-300",
    })
  }
  if (isShieldActive) {
    activeBuffs.push({
      key: "shield",
      label: "Escudo",
      emoji: "🛡️",
      borderColor: "border-yellow-400/60",
      bgColor: "bg-yellow-400/10",
      textColor: "text-yellow-300",
    })
  }
  if (isExtremeCadenceActive) {
    activeBuffs.push({
      key: "cadence",
      label: "Cadencia Extrema",
      emoji: "🔥",
      borderColor: "border-rose-400/60",
      bgColor: "bg-rose-400/10",
      textColor: "text-rose-300",
    })
  }

  if (activeBuffs.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute bottom-20 right-4 z-40 flex flex-col items-end gap-1.5"
      aria-label="Efectos activos"
    >
      {/* Encabezado */}
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 mr-1">
        Efectos Activos
      </span>

      {/* Lista de buffs activos */}
      {activeBuffs.map((buff) => (
        <div
          key={buff.key}
          className={`flex items-center gap-1.5 rounded-md border ${buff.borderColor} ${buff.bgColor} px-2.5 py-1 shadow-lg backdrop-blur animate-pulse`}
          aria-live="polite"
        >
          <span className="text-sm leading-none">{buff.emoji}</span>
          <span
            className={`text-[11px] font-bold uppercase tracking-wider ${buff.textColor}`}
          >
            {buff.label}
          </span>
        </div>
      ))}
    </div>
  )
}
