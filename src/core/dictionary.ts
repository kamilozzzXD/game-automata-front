// Diccionarios para traducir nombres tecnicos del backend a nombres amigables
// que ve el jugador. Regla de oro: el jugador NUNCA debe ver q0, A, P1, etc.

import type { AutomatonState, Ingredient, PotionId, TransitionOutput } from "../types/game"
import type { DungeonNodeType } from "../types/dungeon"

export const INGREDIENT_NAMES: Record<Ingredient, string> = {
  A: "Agua",
  B: "Hierba",
  C: "Hongo",
  D: "Fuego",
  E: "Cristal",
}

export const POTION_NAMES: Record<PotionId | "P_basura", string> = {
  P1: "Pocion Menor de Curacion",
  P2: "Agua Purificada",
  P3: "Fuego Liquido",
  P4: "Pocion de Invisibilidad",
  P5: "Pocion de Curacion Mayor",
  P6: "Pocion de Regeneracion",
  P7: "Pocion de Mana Mayor",
  P8: "Pocion de Vision Nocturna",
  P9: "Pocion de Resistencia al Fuego",
  P10: "Pocion de Gravedad",
  P_basura: "Pocion Basura",
}

// Sprint Polish-Pass - Tarea 2.
// Color distintivo por tipo de pocion. Se usa de forma consistente en:
//   - Caldero (animacion de exito tras craftear)
//   - HUD / inventario abierto
//   - Barra rapida vertical (PotionHotbar)
// El "text" es la clase tailwind del icono y los efectos visuales.
// El "glow" es la sombra (rgba) usada para el resaltado del slot
// seleccionado de la hotbar (no se puede interpolar via tailwind).
export const POTION_COLORS: Record<PotionId, { text: string; glow: string }> = {
  P1: { text: "text-red-400", glow: "rgba(248,113,113,0.55)" }, // curacion menor
  P2: { text: "text-sky-300", glow: "rgba(125,211,252,0.55)" }, // agua purificada
  P3: { text: "text-orange-400", glow: "rgba(251,146,60,0.55)" }, // fuego liquido
  P4: { text: "text-cyan-300", glow: "rgba(103,232,249,0.55)" }, // invisibilidad
  P5: { text: "text-rose-400", glow: "rgba(251,113,133,0.55)" }, // curacion mayor
  P6: { text: "text-emerald-400", glow: "rgba(52,211,153,0.55)" }, // regeneracion
  P7: { text: "text-blue-400", glow: "rgba(96,165,250,0.55)" }, // mana mayor
  P8: { text: "text-indigo-300", glow: "rgba(165,180,252,0.55)" }, // vision nocturna
  P9: { text: "text-amber-400", glow: "rgba(251,191,36,0.55)" }, // resistencia al fuego
  P10: { text: "text-lime-400", glow: "rgba(163,230,53,0.55)" }, // gravedad
}

// Color para la pocion basura (usado en el caldero al fallar la mezcla).
export const TRASH_POTION_COLOR = { text: "text-stone-500", glow: "rgba(120,113,108,0.45)" }

// Estado del caldero traducido a lo que el jugador deberia entender.
// Cualquier estado intermedio se describe como "Mezclando..." para no exponer la matematica.
export function describeCauldronState(state: AutomatonState): string {
  if (state === "q0") return "Caldero Vacio"
  return "Mezclando..."
}

// Util para saber si la salida del backend es una pocion exitosa (P1-P10)
export function isSuccessfulPotion(output: TransitionOutput): output is PotionId {
  return output !== "-" && output !== "P_basura"
}

// ----- Diccionarios de la Mazmorra (Sprint 3) -----
// Nombres amigables para los tipos de nodo del AST que devuelve la GLC.
export const DUNGEON_NODE_NAMES: Record<DungeonNodeType, string> = {
  inicio: "Entrada",
  pasillo: "Pasillo",
  sala: "Sala Secreta",
  jefe: "Guarida del Jefe",
}

// Descripciones cortas mostradas debajo de cada nodo en el mapa.
export const DUNGEON_NODE_DESCRIPTIONS: Record<DungeonNodeType, string> = {
  inicio: "Aqui empieza tu aventura",
  pasillo: "Un camino sinuoso",
  sala: "Tesoros y peligros menores",
  jefe: "El enemigo final te espera",
}

