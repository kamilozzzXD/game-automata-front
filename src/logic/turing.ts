// ==========================================
// MODULO 4: COMBATE (MAQUINA DE TURING)
// ==========================================
// Traduccion exacta del backend Python a TypeScript puro.
// Implementa el sistema de vida usando una Maquina de Turing
// para calcular la sustraccion propia (m - n).

import type { CombatResponse } from "../types/game"

// Simbolos de la cinta de Turing
type TuringSymbol = "B" | "1" | "0" | "X"

// Estados de la Maquina de Turing
type TuringState = "e_start" | "e_find_dmg" | "e_find_hp" | "e_clean" | "e_accept"

/**
 * Simula una Maquina de Turing para calcular la sustraccion propia (m - n).
 * Garantiza que si n > m, el resultado es 0 sin desbordamiento.
 * 
 * La cinta se inicializa como: B + (m veces 1) + 0 + (n veces 1) + B
 * Donde:
 * - B = Blanco (simbolo de borde)
 * - 1 = Representacion unaria de los numeros
 * - 0 = Separador entre HP y dano
 * - X = Marca de tachar (usado durante el proceso)
 * 
 * @param m - HP actual (numero a restar)
 * @param n - Dano recibido (numero que se resta)
 * @returns Tupla [hp_final, cinta_final]
 */
function simularTuringSustraccion(m: number, n: number): [number, string] {
  // Inicializacion de la cinta unaria
  const cinta: TuringSymbol[] = [
    "B",
    ...Array(m).fill("1") as TuringSymbol[],
    "0",
    ...Array(n).fill("1") as TuringSymbol[],
    "B",
  ]
  
  let cabezal = 1 // Empezamos en el primer '1' del HP
  let estado: TuringState = "e_start"
  let iteracion = 0
  const maxIteraciones = 50000 // Limite de seguridad

  while (estado !== "e_accept" && iteracion < maxIteraciones) {
    const simbolo = cinta[cabezal]

    switch (estado) {
      case "e_start":
        // Avanzamos a la derecha buscando el 0 divisor
        if (simbolo === "1" || simbolo === "X") {
          cabezal += 1
        } else if (simbolo === "0") {
          estado = "e_find_dmg"
          cabezal += 1
        }
        break

      case "e_find_dmg":
        // Avanzamos a la derecha buscando un 1 de dano para tachar
        if (simbolo === "X") {
          cabezal += 1
        } else if (simbolo === "1") {
          cinta[cabezal] = "X" // Tachamos un punto de dano
          estado = "e_find_hp"
          cabezal -= 1
        } else if (simbolo === "B") {
          // No encontramos mas 1s, se acabo el dano
          estado = "e_accept"
        }
        break

      case "e_find_hp":
        // Retrocedemos a la izquierda cruzando el 0 buscando vida
        if (simbolo === "X" || simbolo === "0") {
          cabezal -= 1
        } else if (simbolo === "1") {
          cinta[cabezal] = "X" // Tachamos un punto de vida
          estado = "e_start" // Volvemos a empezar el ciclo
          cabezal += 1
        } else if (simbolo === "B") {
          // Nos quedamos sin vida antes de terminar el dano
          // Evitamos el desbordamiento pasando a limpiar la cinta
          estado = "e_clean"
          cabezal += 1
        }
        break

      case "e_clean":
        // Avanzamos a la derecha transformando dano restante en Blancos
        if (simbolo === "X" || simbolo === "0") {
          cabezal += 1
        } else if (simbolo === "1") {
          cinta[cabezal] = "B" // Limpiamos el dano sobrante
          cabezal += 1
        } else if (simbolo === "B") {
          estado = "e_accept"
        }
        break
    }

    iteracion += 1
  }

  // Contamos los '1' que quedaron a la izquierda del '0' para saber el HP final
  const indiceCero = cinta.indexOf("0")
  const hpFinal = cinta.slice(0, indiceCero).filter(s => s === "1").length
  const cintaStr = cinta.join("")
  
  return [hpFinal, cintaStr]
}

/**
 * Procesa el dano usando la Maquina de Turing.
 * Esta funcion reemplaza el endpoint /api/combat/hit.
 * 
 * @param hp_actual - La vida que tiene el objetivo ANTES del golpe
 * @param dano_recibido - Cuanto dano hace el proyectil
 * @returns Respuesta con HP resultante, cinta final y mensaje
 */
export function procesarDanoTuring(
  hp_actual: number,
  dano_recibido: number
): CombatResponse {
  // Validar valores
  if (hp_actual < 0 || dano_recibido < 0) {
    throw new Error("Valores negativos no permitidos.")
  }

  // Ejecutar la Maquina de Turing para Sustraccion Propia
  const [hp_resultante, cinta_final] = simularTuringSustraccion(hp_actual, dano_recibido)

  // Generar mensaje para la UI
  let mensaje_ui: string
  if (hp_resultante === 0) {
    mensaje_ui = "La barra de vida se ha vaciado! (El dano sobrante fue limpiado por la cinta de Turing)."
  } else {
    mensaje_ui = `Recibes ${dano_recibido} de dano. Vida restante: ${hp_resultante}.`
  }

  return {
    hp_resultante,
    cinta_final,
    mensaje_ui,
  }
}
