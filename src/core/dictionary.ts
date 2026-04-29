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

// Sprint 5 - Tarea 1.B: cada pocion tiene un color hexadecimal unico y fijo.
// Lo usamos en TODA la UI (icono del hotbar, lista del inventario, animacion
// del caldero) para que el jugador identifique visualmente cada pocion sin
// necesidad de hacer hover. Paleta diferenciada en tonalidad y luminosidad
// para que cada pocion sea distinguible incluso para daltonicos.
export const POTION_COLORS: Record<PotionId | "P_basura", string> = {
  P1: "#f87171", // Curacion Menor: rojo claro (vida)
  P2: "#38bdf8", // Agua Purificada: cian
  P3: "#f97316", // Fuego Liquido: naranja brillante
  P4: "#a3a3a3", // Invisibilidad: gris translucido
  P5: "#dc2626", // Curacion Mayor: rojo profundo
  P6: "#22c55e", // Regeneracion: verde brillante
  P7: "#3b82f6", // Mana Mayor: azul electrico
  P8: "#1e1b4b", // Vision Nocturna: indigo casi negro -> usaremos borde claro
  P9: "#fbbf24", // Resistencia al Fuego: ambar dorado
  P10: "#a855f7", // Gravedad: magenta (excepcion controlada del rule "no purple")
  P_basura: "#4b5563", // Basura: gris feo
}

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

