// ==========================================
// API SERVICE - Funciones locales (offline)
// ==========================================
// Toda la logica ahora se ejecuta localmente en TypeScript puro.
// No requiere backend FastAPI ni conexion a internet.

import type { CombatRequest, CombatResponse, CraftRequest, CraftResponse } from "../types/game"
import type { DungeonResponse } from "../types/dungeon"
import type { BossRequest, BossResponse } from "../types/boss"

// Importar la logica traducida de Python
import { procesarIngrediente } from "../logic/mealy"
import { generarMazmorra } from "../logic/dungeon"
import { procesarIAEnemigo } from "../logic/moore"
import { procesarDanoTuring } from "../logic/turing"

/**
 * Procesa una transicion de la Maquina de Mealy (Alquimia).
 * Ejecuta la logica localmente sin llamar al backend.
 */
export async function craft(payload: CraftRequest): Promise<CraftResponse> {
  try {
    const result = procesarIngrediente(
      payload.estado_actual,
      payload.ingrediente
    )
    return result
  } catch (error) {
    throw new Error(`Error en craft: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Genera una mazmorra procedural usando la GLC.
 * Ejecuta la logica localmente sin llamar al backend.
 */
export async function generateDungeon(): Promise<DungeonResponse> {
  try {
    return generarMazmorra()
  } catch (error) {
    throw new Error(`Error en generate-dungeon: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Ejecuta un paso de la Maquina de Moore del jefe (IA del Enemigo).
 * Ejecuta la logica localmente sin llamar al backend.
 */
export async function bossAction(payload: BossRequest): Promise<BossResponse> {
  try {
    return procesarIAEnemigo(
      payload.estado_actual,
      payload.estimulo
    )
  } catch (error) {
    throw new Error(`Error en boss-action: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Procesa el dano usando la Maquina de Turing (Sistema de Combate).
 * Ejecuta la logica localmente sin llamar al backend.
 */
export async function combatHit(payload: CombatRequest): Promise<CombatResponse> {
  try {
    return procesarDanoTuring(
      payload.hp_actual,
      payload.dano_recibido
    )
  } catch (error) {
    throw new Error(`Error en combat/hit: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
