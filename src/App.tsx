import { useGameStore } from "./core/gameStore"
import { DungeonScene } from "./scenes/DungeonScene"
import { ForestScene } from "./scenes/ForestScene"
import { DeathScreen } from "./components/ui/DeathScreen"
import { VictoryScreen } from "./components/ui/VictoryScreen"

function App() {
  // Router de escenas. Mantener al jugador en el mismo store hace que el
  // inventario, las pociones y el progreso se conserven entre escenas.
  const currentScene = useGameStore((s) => s.currentScene)

  return (
    <>
      {currentScene === "dungeon" ? <DungeonScene /> : <ForestScene />}
      <DeathScreen />
      <VictoryScreen />
    </>
  )
}

export default App
