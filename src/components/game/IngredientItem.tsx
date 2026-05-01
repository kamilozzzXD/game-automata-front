import {
  GiCrystalGrowth,
  GiFire,
  GiHerbsBundle,
  GiMushroomGills,
  GiWaterDrop,
} from "react-icons/gi"
import type { Ingredient, Size, Vector2D } from "../../types/game"

type Props = {
  ingredient: Ingredient
  position?: Vector2D
  size: Size
}

export function IngredientItem({ ingredient, position, size }: Props) {
  // Elegimos icono y color según el tipo de ingrediente
  let Icon = GiWaterDrop
  let color = "text-sky-300 drop-shadow-[0_0_10px_rgba(125,211,252,0.6)]"

  switch (ingredient) {
    case "A":
      Icon = GiWaterDrop
      color = "text-sky-300 drop-shadow-[0_0_10px_rgba(125,211,252,0.6)]"
      break
    case "B":
      Icon = GiHerbsBundle
      color = "text-emerald-300 drop-shadow-[0_0_10px_rgba(110,231,183,0.6)]"
      break
    case "C":
      Icon = GiMushroomGills
      color = "text-amber-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.6)]"
      break
    case "D":
      Icon = GiFire
      color = "text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.6)]"
      break
    case "E":
      Icon = GiCrystalGrowth
      color = "text-fuchsia-300 drop-shadow-[0_0_10px_rgba(240,171,252,0.6)]"
      break
  }

  return (
    <div
      className={`${position ? "absolute" : "relative"} z-20 flex items-center justify-center animate-bounce-slow`}
      style={{
        ...(position ? { left: position.x, top: position.y } : {}),
        width: size.width,
        height: size.height,
      }}
      aria-label={`Ingrediente ${ingredient}`}
    >
      {/* Halo de fondo para destacar */}
      <div
        className="absolute inset-0 rounded-full animate-pulse opacity-50 bg-current mix-blend-screen"
        style={{ color: "inherit" }}
        aria-hidden
      />
      <Icon className={`relative ${color}`} size={Math.min(size.width, size.height) * 0.8} />
    </div>
  )
}
