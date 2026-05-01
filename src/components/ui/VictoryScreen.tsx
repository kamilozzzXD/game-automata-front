import { useEffect } from "react"
import { useGameStore } from "../../core/gameStore"
import victoryScreenImg from "../../assets/victoria-jugador.png"

export function VictoryScreen() {
  const bossLives = useGameStore((s) => s.bossLives)
  const setCurrentScene = useGameStore((s) => s.setCurrentScene)
  const setPlayerHp = useGameStore((s) => s.setPlayerHp)
  const setPlayerPosition = useGameStore((s) => s.setPlayerPosition)
  const setPlayerInvisible = useGameStore((s) => s.setPlayerInvisible)
  const resetBoss = useGameStore((s) => s.resetBoss)
  const resetBossHealth = useGameStore((s) => s.resetBossHealth)

  useEffect(() => {
    if (bossLives > 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        setCurrentScene("forest")
        setPlayerPosition({ x: 230, y: 260 })
        setPlayerInvisible(false)
        setPlayerHp(100)
        resetBoss()
        resetBossHealth()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [bossLives, setCurrentScene, setPlayerHp, setPlayerPosition, setPlayerInvisible, resetBoss, resetBossHealth])

  if (bossLives > 0) return null

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
      <img
        src={victoryScreenImg}
        alt="¡Victoria!"
        className="max-w-[80%] max-h-[60%] object-contain mb-8 animate-in slide-in-from-bottom duration-700"
      />
      <p className="text-white text-xl font-bold animate-pulse">
        Presiona <kbd className="bg-white/20 px-2 py-1 rounded border border-white/20">ENTER</kbd> para volver al inicio
      </p>
    </div>
  )
}
