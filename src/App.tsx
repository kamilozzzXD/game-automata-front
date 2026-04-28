import { useGameStore } from "./core/gameStore"
import { DungeonScene } from "./scenes/DungeonScene"
import { ForestScene } from "./scenes/ForestScene"

function App() {
  // Router de escenas. Mantener al jugador en el mismo store hace que el
  // inventario, las pociones y el progreso se conserven entre escenas.
  const currentScene = useGameStore((s) => s.currentScene)

  if (currentScene === "dungeon") return <DungeonScene />
  return <ForestScene />
}

export default App
