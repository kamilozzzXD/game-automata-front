import { useEffect } from "react"
import { useGameStore } from "../../core/gameStore"
import deathScreenImg from "../../assets/ventana-muerte.png"

export function DeathScreen() {
  const playerHp = useGameStore((s) => s.playerHp)
  const setCurrentScene = useGameStore((s) => s.setCurrentScene)
  const setPlayerHp = useGameStore((s) => s.setPlayerHp)
  const setPlayerPosition = useGameStore((s) => s.setPlayerPosition)
  const setPlayerInvisible = useGameStore((s) => s.setPlayerInvisible)
  const clearNotifications = useGameStore((s) => s.clearNotifications)

  useEffect(() => {
    if (playerHp > 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        clearNotifications()
        setCurrentScene("forest")
        setPlayerPosition({ x: 230, y: 260 })
        setPlayerInvisible(false)
        setPlayerHp(100)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [playerHp, setCurrentScene, setPlayerHp, setPlayerPosition, setPlayerInvisible, clearNotifications])

  if (playerHp > 0) return null

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      <img 
        src={deathScreenImg} 
        alt="Has Muerto" 
        className="max-w-[80%] max-h-[60%] object-contain mb-8 animate-in fade-in zoom-in duration-700"
      />
      <p className="text-white text-xl font-bold animate-pulse">
        Presiona <kbd className="bg-white/20 px-2 py-1 rounded">ENTER</kbd> para volver al inicio
      </p>
    </div>
  )
}
