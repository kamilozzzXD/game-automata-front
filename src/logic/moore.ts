// ==========================================
// MODULO 3: IA DEL ENEMIGO (MAQUINA DE MOORE)
// ==========================================
// Traduccion exacta del backend Python a TypeScript puro.
// Implementa la IA del jefe usando una Maquina de Moore.

import type { BossState, BossStimulus, BossAction, BossResponse } from "../types/boss"

// Tabla de transiciones de la Maquina de Moore
// Estado actual -> Estimulo -> Nuevo estado
type MooreTransitions = {
  [state in BossState]: {
    [stimulus in BossStimulus]: BossState
  }
}

export const MOORE_TRANSITIONS: MooreTransitions = {
  A: { r: "B", v: "C", p: "A", h: "C" },
  B: { r: "B", v: "C", p: "A", h: "C" },
  C: { r: "C", v: "C", p: "B", h: "C" },
}

// Funcion de salida de la Maquina de Moore
// La salida depende unicamente del estado (caracteristica de Moore)
export const MOORE_OUTPUTS: Record<BossState, BossAction> = {
  A: "Patrullar",
  B: "Buscar",
  C: "Atacar",
}

// Mensajes narrativos para la UI
export const MENSAJES_IA: Record<BossAction, string> = {
  Patrullar: "El jefe esta tranquilo. Patrulla la sala lentamente.",
  Buscar: "El jefe ha escuchado algo! Esta alerta buscando intrusos.",
  Atacar: "El jefe te ha visto! Entra en combate y se abalanza sobre ti.",
}

/**
 * Procesa un paso de la Maquina de Moore del jefe.
 * Recibe el estado actual y el estimulo, devuelve el nuevo estado y la accion.
 * 
 * Estimulos:
 * - r: ruido (el jugador hace ruido cercano)
 * - v: vision (el jefe ve al jugador)
 * - p: perdida de vision (el jugador se oculta o escapa)
 * - h: hostilidad (el jefe recibe un impacto o proyectil cercano)
 * 
 * Estados y acciones:
 * - A: Patrullar (tranquilo, se mueve lentamente)
 * - B: Buscar (alerta, busca al jugador)
 * - C: Atacar (agresivo, persigue y ataca)
 */
export function procesarIAEnemigo(
  estado_actual: BossState,
  estimulo: BossStimulus
): BossResponse {
  // Validar estado
  if (!(estado_actual in MOORE_TRANSITIONS)) {
    throw new Error(`Estado del automata invalido: ${estado_actual}`)
  }

  // Validar estimulo
  const estimulosValidos: BossStimulus[] = ["r", "v", "p", "h"]
  if (!estimulosValidos.includes(estimulo)) {
    throw new Error(`Estimulo no reconocido: ${estimulo}`)
  }

  // Ejecutar la transicion
  const nuevo_estado = MOORE_TRANSITIONS[estado_actual][estimulo]
  
  // Obtener la accion del nuevo estado (funcion de salida de Moore)
  const accion = MOORE_OUTPUTS[nuevo_estado]
  
  // Obtener el mensaje narrativo
  const mensaje_ui = MENSAJES_IA[accion]

  return {
    nuevo_estado,
    accion,
    mensaje_ui,
  }
}
