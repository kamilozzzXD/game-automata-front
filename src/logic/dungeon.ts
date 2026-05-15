// ==========================================
// MODULO 2: MAZMORRAS (GRAMATICA LIBRE DE CONTEXTO)
// ==========================================
// Traduccion exacta del backend Python a TypeScript puro.
// Genera mazmorras procedurales usando una GLC.

import type { DungeonNode, DungeonResponse } from "../types/dungeon"
import type { Ingredient } from "../types/game"

// Contador global de IDs (se resetea al generar una nueva mazmorra)
let contId = 0

function obtenerNuevoId(): number {
  contId += 1
  return contId
}

/**
 * Regla de Produccion A:
 * A -> sala | epsilon
 * 50% de probabilidad de generar una sala
 */
function resolverA(): DungeonNode[] {
  if (Math.random() < 0.5) {
    return [{
      id: obtenerNuevoId(),
      tipo: "sala",
      conexiones: [],
      ingredientes: [],
    }]
  }
  return []
}

/**
 * Regla de Produccion R (recursiva con profundidad limitada):
 * R -> pasillo A R | pasillo A
 * Genera un pasillo, opcionalmente conecta una sala,
 * y opcionalmente continua con mas pasillos.
 */
function resolverR(profundidadMax: number = 3): DungeonNode[] {
  const nodosR: DungeonNode[] = []
  
  // Crear el pasillo actual
  const pasillo: DungeonNode = {
    id: obtenerNuevoId(),
    tipo: "pasillo",
    conexiones: [],
    ingredientes: [],
  }
  nodosR.push(pasillo)

  // Intentar conectar una sala
  const nodosA = resolverA()
  if (nodosA.length > 0) {
    const sala = nodosA[0]
    pasillo.conexiones.push(sala.id)
    nodosR.push(sala)
  }

  // Continuar recursivamente con 50% de probabilidad
  if (profundidadMax > 0 && Math.random() < 0.5) {
    const restoDeRuta = resolverR(profundidadMax - 1)
    if (restoDeRuta.length > 0) {
      const siguientePasillo = restoDeRuta[0]
      pasillo.conexiones.push(siguientePasillo.id)
      nodosR.push(...restoDeRuta)
    }
  }

  return nodosR
}

/**
 * Regla de Produccion para Ingredientes:
 * Ings -> I Ings | I
 * I -> 'A' | 'B' | 'C' | 'D' | 'E'
 * Genera una cantidad variable de ingredientes (minimo 2, multiplicado por 2)
 */
function resolverIngredientes(): Ingredient[] {
  const opciones: Ingredient[] = ["A", "B", "C", "D", "E"]
  
  // Determinar cantidad base usando la gramatica
  let cantidad = 1
  while (Math.random() < 0.5) {
    cantidad += 1
  }
  
  // Multiplicar por 2 para aumentar la cantidad generada
  cantidad *= 2
  
  // Generar ingredientes aleatorios
  const resultados: Ingredient[] = []
  for (let i = 0; i < cantidad; i++) {
    const idx = Math.floor(Math.random() * opciones.length)
    resultados.push(opciones[idx])
  }
  
  return resultados
}

/**
 * Segunda Gramatica Libre de Contexto para esparcir ingredientes.
 * Asegura que los materiales solo puedan estar en pasillo e inicio.
 * Garantiza al menos 1 por nodo valido, permitiendo multiples.
 */
function aplicarGramaticaIngredientes(nodos: DungeonNode[]): DungeonNode[] {
  for (const nodo of nodos) {
    if (nodo.tipo === "inicio" || nodo.tipo === "pasillo") {
      nodo.ingredientes = resolverIngredientes()
    } else {
      nodo.ingredientes = [] // Nunca en jefe o sala
    }
  }
  return nodos
}

/**
 * Regla de Produccion N (simbolo inicial):
 * N -> inicio R jefe
 * Genera la estructura completa de la mazmorra: inicio, pasillos/salas, jefe.
 */
function resolverN(): DungeonNode[] {
  // Resetear el contador de IDs
  contId = 0
  const nodosTotales: DungeonNode[] = []

  // Crear el nodo de inicio
  const inicio: DungeonNode = {
    id: obtenerNuevoId(),
    tipo: "inicio",
    conexiones: [],
    ingredientes: [],
  }
  nodosTotales.push(inicio)

  // Generar la ruta (pasillos y salas)
  const nodosR = resolverR()
  if (nodosR.length > 0) {
    inicio.conexiones.push(nodosR[0].id)
    nodosTotales.push(...nodosR)
  }

  // Crear el nodo del jefe
  const jefe: DungeonNode = {
    id: obtenerNuevoId(),
    tipo: "jefe",
    conexiones: [],
    ingredientes: [],
  }
  
  // Conectar el ultimo pasillo al jefe
  const ultimoPasillo = [...nodosR].reverse().find(n => n.tipo === "pasillo")
  if (ultimoPasillo) {
    ultimoPasillo.conexiones.push(jefe.id)
  }

  nodosTotales.push(jefe)
  return nodosTotales
}

/**
 * Genera una mazmorra completa usando la Gramatica Libre de Contexto.
 * Esta es la funcion principal que reemplaza el endpoint /api/generate-dungeon.
 */
export function generarMazmorra(): DungeonResponse {
  // Generar el AST de la mazmorra
  let astSimulado = resolverN()
  
  // Aplicar la segunda gramatica para asignar ingredientes
  astSimulado = aplicarGramaticaIngredientes(astSimulado)
  
  // Construir la cadena plana para debug/visualizacion
  const elementosCadena: string[] = []
  for (const nodo of astSimulado) {
    if (nodo.ingredientes && nodo.ingredientes.length > 0) {
      const ingsStr = nodo.ingredientes.join(",")
      elementosCadena.push(`${nodo.tipo}[${ingsStr}]`)
    } else {
      elementosCadena.push(nodo.tipo)
    }
  }
  
  const cadenaPlana = elementosCadena.join(" ")
  
  return {
    cadena_plana: cadenaPlana,
    estructura_ast: astSimulado,
    mensaje_ui: "Mazmorra generada con exito, con ingredientes esparcidos.",
  }
}
