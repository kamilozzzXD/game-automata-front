import type { CombatRequest, CombatResponse, CraftRequest, CraftResponse } from "../types/game"
import type { DungeonResponse } from "../types/dungeon"
import type { BossRequest, BossResponse } from "../types/boss"

const API_BASE_URL = ""

/**
 * Llama al backend para procesar una transicion de la Maquina de Mealy.
 * El backend recibe el estado actual + el ingrediente y devuelve
 * el nuevo estado y la salida de la transicion.
 */
export async function craft(payload: CraftRequest): Promise<CraftResponse> {
  const response = await fetch(`${API_BASE_URL}/api/craft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Error en /api/craft: ${response.status}`)
  }

  return (await response.json()) as CraftResponse
}

/**
 * Llama al backend para generar una mazmorra procedural usando la GLC.
 * No requiere body: el backend resuelve el simbolo inicial N y devuelve
 * la cadena plana + el AST listo para renderizar.
 */
export async function generateDungeon(): Promise<DungeonResponse> {
  const response = await fetch(`${API_BASE_URL}/api/generate-dungeon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })

  if (!response.ok) {
    throw new Error(`Error en /api/generate-dungeon: ${response.status}`)
  }

  return (await response.json()) as DungeonResponse
}

/**
 * Llama al backend para ejecutar UN paso de la Maquina de Moore del jefe.
 * Recibe el estado actual + el estimulo (r/v/p) y devuelve el nuevo estado,
 * la accion derivada (Patrullar/Buscar/Atacar) y un mensaje narrativo.
 *
 * El backend es DETERMINISTA: misma (estado, estimulo) -> misma transicion.
 */
export async function bossAction(payload: BossRequest): Promise<BossResponse> {
  const response = await fetch(`${API_BASE_URL}/api/boss-action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Error en /api/boss-action: ${response.status}`)
  }

  return (await response.json()) as BossResponse
}

/**
 * Tarea 3.3 - Sistema de combate (Máquina de Turing).
 * Llama al backend para ejecutar la sustracción propia en la cinta de Turing.
 * Recibe HP actual + daño y devuelve el HP resultante (nunca negativo).
 */
export async function combatHit(payload: CombatRequest): Promise<CombatResponse> {
  const response = await fetch(`${API_BASE_URL}/api/combat/hit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Error en /api/combat/hit: ${response.status}`)
  }

  return (await response.json()) as CombatResponse
}