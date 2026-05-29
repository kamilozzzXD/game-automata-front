import { useState } from "react"
import { useGameStore } from "./core/gameStore"
import { DungeonScene } from "./scenes/DungeonScene"
import { ForestScene } from "./scenes/ForestScene"
import { DeathScreen } from "./components/ui/DeathScreen"
import { VictoryScreen } from "./components/ui/VictoryScreen"
import { IntroCinematic } from "./components/ui/IntroCinematic"

function App() {
  // Router de escenas. Mantener al jugador en el mismo store hace que el
  // inventario, las pociones y el progreso se conserven entre escenas.
  const currentScene = useGameStore((s) => s.currentScene)
  const clearNotifications = useGameStore((s) => s.clearNotifications)
  const [showIntro, setShowIntro] = useState(true)

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
    <>
      {currentScene === "dungeon" ? <DungeonScene /> : <ForestScene />}
      <DeathScreen />
      <VictoryScreen />
    </>
  )
}

export default App
