// ==========================================
// MODULO 1: ALQUIMIA (MAQUINA DE MEALY)
// ==========================================
// Traduccion exacta del backend Python a TypeScript puro.
// No requiere fetch ni llamadas a APIs externas.

import type { AutomatonState, Ingredient, TransitionOutput } from "../types/game"

// Definicion de la Maquina de Mealy
// Cada estado mapea cada ingrediente a una tupla [nuevo_estado, salida]
type MealyTransitions = {
  [state: string]: {
    [ingredient in Ingredient]: [AutomatonState, TransitionOutput]
  }
}

export const MEALY_MACHINE: MealyTransitions = {
  q0:  { A: ["qA", "-"],  B: ["q0", "P1"], C: ["q0", "P_basura"], D: ["qD", "-"],  E: ["qE", "-"] },
  qA:  { A: ["q0", "P2"], B: ["qAB", "-"], C: ["qAC", "-"],       D: ["q0", "P_basura"], E: ["q0", "P_basura"] },
  qD:  { A: ["q0", "P_basura"], B: ["q0", "P_basura"], C: ["q0", "P_basura"], D: ["q0", "P3"], E: ["qDE", "-"] },
  qE:  { A: ["q0", "P_basura"], B: ["q0", "P_basura"], C: ["q0", "P4"],       D: ["q0", "P_basura"], E: ["qEE", "-"] },
  qAB: { A: ["q0", "P_basura"], B: ["q0", "P5"], C: ["q0", "P6"], D: ["q0", "P_basura"], E: ["q0", "P_basura"] },
  qAC: { A: ["q0", "P_basura"], B: ["q0", "P_basura"], C: ["q0", "P7"], D: ["q0", "P8"], E: ["q0", "P_basura"] },
  qDE: { A: ["q0", "P_basura"], B: ["q0", "P_basura"], C: ["q0", "P_basura"], D: ["q0", "P_basura"], E: ["q0", "P9"] },
  qEE: { A: ["q0", "P_basura"], B: ["q0", "P_basura"], C: ["q0", "P_basura"], D: ["q0", "P_basura"], E: ["q0", "P10"] },
}

// Nombres de las pociones para mostrar en la UI
// A=Agua, B=Hierba, C=Hongo, D=Fuego, E=Cristal
export const NOMBRES_POCIONES: Record<string, string> = {
  P1: "Pocion Menor de Curacion",
  P2: "Aceite de Punteria",           // Mejora el disparo
  P3: "Mezcla Volatil",               // Ataque explosivo
  P4: "Pocion de Invisibilidad",      // Pasa desapercibido ante los enemigos
  P5: "Pocion de Curacion Mayor",
  P6: "Pocion de Velocidad de Movimiento", // Para esquivar mejor
  P7: "Suero de Disparo Multiple",    // Mas disparos
  P8: "Tonico de Hiper-Reflejos",     // Mas agilidad
  P9: "Escudo de Energia",            // Invencibilidad temporal
  P10: "Brebaje de Cadencia Extrema", // Aumenta la velocidad de disparo
  P_basura: "Pocion Basura (Huele terrible...)",
}

// Interfaz de respuesta (equivalente a CraftResponse del backend)
export interface CraftResult {
  nuevo_estado: AutomatonState
  salida: TransitionOutput
  mensaje_ui: string
}

/**
 * Procesa una transicion de la Maquina de Mealy.
 * Recibe el estado actual y el ingrediente, devuelve el nuevo estado y la salida.
 * Esta funcion es pura y determinista - no tiene efectos secundarios.
 */
export function procesarIngrediente(
  estado_actual: AutomatonState,
  ingrediente: Ingredient
): CraftResult {
  // Validar que el estado existe en la maquina
  if (!(estado_actual in MEALY_MACHINE)) {
    throw new Error(`Estado invalido: ${estado_actual}`)
  }

  // Validar que el ingrediente es valido
  const ingredientesValidos: Ingredient[] = ["A", "B", "C", "D", "E"]
  if (!ingredientesValidos.includes(ingrediente)) {
    throw new Error(`Ingrediente no reconocido: ${ingrediente}`)
  }

  // Ejecutar la transicion
  const [nuevo_estado, salida] = MEALY_MACHINE[estado_actual][ingrediente]

  // Generar mensaje para la UI
  let mensaje: string
  if (salida === "-") {
    mensaje = "Ingrediente anadido. La mezcla reacciona..."
  } else if (salida === "P_basura") {
    mensaje = "Mezcla fallida! Has creado una Pocion Basura."
  } else {
    const nombre_pocion = NOMBRES_POCIONES[salida] ?? "Pocion Desconocida"
    mensaje = `Exito! Has creado: ${nombre_pocion}.`
  }

  return {
    nuevo_estado,
    salida,
    mensaje_ui: mensaje,
  }
}
