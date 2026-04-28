import type { CraftRequest, CraftResponse } from "../types/game"

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

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
