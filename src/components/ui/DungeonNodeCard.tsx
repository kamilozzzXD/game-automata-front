import {
  GiOpenTreasureChest,
  GiPathDistance,
  GiSkullCrossedBones,
  GiWoodenDoor,
} from "react-icons/gi"
import type { IconType } from "react-icons"
import type { DungeonNode, DungeonNodeType } from "../../types/dungeon"
import { DUNGEON_NODE_DESCRIPTIONS, DUNGEON_NODE_NAMES } from "../../core/dictionary"

// Icono distinto por cada tipo de nodo (regla de oro: nada de terminos tecnicos al jugador).
const NODE_ICONS: Record<DungeonNodeType, IconType> = {
  inicio: GiWoodenDoor,
  pasillo: GiPathDistance,
  sala: GiOpenTreasureChest,
  jefe: GiSkullCrossedBones,
}

// Estilo visual por tipo. Mantenemos la paleta del juego (verde / dorado / piedra / rojo).
const NODE_STYLES: Record<
  DungeonNodeType,
  { ring: string; bg: string; icon: string; label: string }
> = {
  inicio: {
    ring: "ring-emerald-400/60",
    bg: "bg-emerald-950/60",
    icon: "text-emerald-300",
    label: "text-emerald-200",
  },
  pasillo: {
    ring: "ring-stone-400/40",
    bg: "bg-stone-900/70",
    icon: "text-stone-300",
    label: "text-stone-200",
  },
  sala: {
    ring: "ring-amber-400/60",
    bg: "bg-amber-950/60",
    icon: "text-amber-300",
    label: "text-amber-200",
  },
  jefe: {
    ring: "ring-red-500/70",
    bg: "bg-red-950/70",
    icon: "text-red-300",
    label: "text-red-200",
  },
}

type Props = {
  node: DungeonNode
}

export function DungeonNodeCard({ node }: Props) {
  const Icon = NODE_ICONS[node.tipo]
  const style = NODE_STYLES[node.tipo]
  const name = DUNGEON_NODE_NAMES[node.tipo]
  const desc = DUNGEON_NODE_DESCRIPTIONS[node.tipo]

  return (
    <div
      className={`flex w-32 shrink-0 flex-col items-center gap-1 rounded-xl border border-border ${style.bg} px-3 py-3 shadow-md ring-2 ${style.ring}`}
    >
      <Icon className={style.icon} size={36} />
      <p className={`text-center text-sm font-semibold leading-tight ${style.label}`}>
        {name}
      </p>
      <p className="text-center text-[10px] leading-tight text-foreground/60">{desc}</p>
    </div>
  )
}
