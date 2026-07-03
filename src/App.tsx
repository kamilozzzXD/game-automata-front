import { useEffect, useState } from "react"
import { useGameStore } from "./core/gameStore"
import { DungeonScene } from "./scenes/DungeonScene"
import { ForestScene } from "./scenes/ForestScene"
import { DeathScreen } from "./components/ui/DeathScreen"
import { VictoryScreen } from "./components/ui/VictoryScreen"
import { IntroCinematic } from "./components/ui/IntroCinematic"
import { debounce } from "./utils/debounce"
import { TouchControls } from "./components/ui/TouchControls"
import { loadImage } from "./utils/assetLoader"
import deathScreenImg from "./assets/ventana-muerte.png"
import victoryScreenImg from "./assets/victoria-jugador.png"
import guiaImg from "./assets/guia.png"

function App() {
  const currentScene = useGameStore((s) => s.currentScene)
  const clearNotifications = useGameStore((s) => s.clearNotifications)
  const [showIntro, setShowIntro] = useState(true)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    // Eager preloading de assets UI pesados para evitar lag/parpadeo al abrir modales
    void loadImage(deathScreenImg)
    void loadImage(victoryScreenImg)
    void loadImage(guiaImg)
  }, [])

  useEffect(() => {
    const calculateScale = () => {
      // Relación de aspecto 16:10 (960x600) con margen del 98%
      const s = Math.min(window.innerWidth / 960, window.innerHeight / 600)
      setScale(s * 0.98)
    }

    calculateScale()

    // Redimensionado optimizado con debounce de 100ms
    const handleResize = debounce(calculateScale, 100)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  if (showIntro) {
    return (
      <IntroCinematic
        onComplete={() => {
          clearNotifications()
          setShowIntro(false)
        }}
      />
    )
  }

  return (
    <main className="flex h-[100dvh] w-[100vw] items-center justify-center bg-background overflow-hidden select-none">
      <div
        style={{
          width: 960,
          height: 600,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          flexShrink: 0,
        }}
        className="relative"
      >
        {currentScene === "dungeon" ? <DungeonScene /> : <ForestScene />}
        <DeathScreen />
        <VictoryScreen />
        <TouchControls />
      </div>
    </main>
  )
}

export default App

