import { useMemo } from "react"
import { GiScrollQuill, GiVortex } from "react-icons/gi"
import { useGameStore } from "../../core/gameStore"
import { generateDungeon } from "../../services/api"
import type { DungeonNode } from "../../types/dungeon"
import { DungeonNodeCard } from "./DungeonNodeCard"

/**
 * Modal que muestra la mazmorra procedural generada por la GLC.
 * El backend devuelve una lista plana de nodos; aqui la convertimos
 * en arbol y la renderizamos recursivamente con Flexbox.
 */
export function DungeonModal() {
  const isOpen = useGameStore((s) => s.isDungeonOpen)
  const isGenerating = useGameStore((s) => s.isGeneratingDungeon)
  const dungeon = useGameStore((s) => s.currentDungeon)
  const closeDungeon = useGameStore((s) => s.closeDungeon)
  const setIsGeneratingDungeon = useGameStore((s) => s.setIsGeneratingDungeon)
  const setCurrentDungeon = useGameStore((s) => s.setCurrentDungeon)
  const pushNotification = useGameStore((s) => s.pushNotification)

  // Map id -> node para resolucion en O(1) durante el render recursivo.
  const nodeMap = useMemo(() => {
    if (!dungeon) return new Map<number, DungeonNode>()
    const m = new Map<number, DungeonNode>()
    for (const n of dungeon.estructura_ast) m.set(n.id, n)
    return m
  }, [dungeon])

  // Encontramos la raiz: por contrato siempre es el nodo "inicio".
  const root = useMemo(() => {
    if (!dungeon) return null
    return dungeon.estructura_ast.find((n) => n.tipo === "inicio") ?? null
  }, [dungeon])

  if (!isOpen) return null

  async function handleRegenerate() {
    setIsGeneratingDungeon(true)
    try {
      const res = await generateDungeon()
      setCurrentDungeon(res)
      pushNotification({ kind: "info", message: res.mensaje_ui })
    } catch (err) {
      console.error("[v0] Error regenerando mazmorra", err)
      pushNotification({
        kind: "error",
        message: "No se pudo generar otra mazmorra.",
      })
    } finally {
      setIsGeneratingDungeon(false)
    }
  }

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dungeon-title"
    >
      <div className="flex h-full max-h-[560px] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border-2 border-border bg-card shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-border bg-background/40 px-5 py-3">
          <div className="flex items-center gap-2">
            <GiScrollQuill className="text-accent" size={22} />
            <h2 id="dungeon-title" className="text-lg font-bold text-card-foreground">
              Mazmorra Generada
            </h2>
          </div>
          <button
            type="button"
            onClick={closeDungeon}
            className="rounded-md border border-border bg-background/60 px-3 py-1 text-xs font-semibold text-card-foreground transition-colors hover:bg-background"
          >
            Volver al Bosque
          </button>
        </header>

        {/* Mensaje del oraculo / backend */}
        {dungeon?.mensaje_ui && (
          <p className="border-b border-border bg-background/30 px-5 py-2 text-sm leading-relaxed text-foreground/80">
            {dungeon.mensaje_ui}
          </p>
        )}

        {/* Cuerpo: arbol scrollable */}
        <div className="flex-1 overflow-auto px-6 py-6">
          {isGenerating && !dungeon && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-foreground/70">
              <GiVortex className="animate-spin text-accent" size={48} />
              <p className="text-sm">Tejiendo la mazmorra...</p>
            </div>
          )}

          {!isGenerating && !root && (
            <div className="flex h-full items-center justify-center text-foreground/60">
              <p className="text-sm">No hay mazmorra que mostrar.</p>
            </div>
          )}

          {root && (
            <div className="flex min-w-max items-start">
              <DungeonBranch
                id={root.id}
                nodeMap={nodeMap}
                visited={new Set<number>()}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 border-t border-border bg-background/40 px-5 py-3">
          <p className="text-xs text-foreground/60">
            Generada por una Gramatica Libre de Contexto.
          </p>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background shadow-md transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <GiVortex
              className={isGenerating ? "animate-spin" : undefined}
              size={16}
            />
            {isGenerating ? "Generando..." : "Generar Otra"}
          </button>
        </footer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Render recursivo del AST como arbol Flex.
// - Cada nodo se dibuja a la izquierda, sus hijos a la derecha (flex-row).
// - Si tiene varios hijos, se apilan verticalmente (flex-col).
// - Entre padre e hijos hay un conector visual (linea horizontal).
// - El set "visited" protege contra ciclos (la GLC no los genera, pero asi
//   evitamos cualquier render infinito si el backend cambia).
// ---------------------------------------------------------------------------
type BranchProps = {
  id: number
  nodeMap: Map<number, DungeonNode>
  visited: Set<number>
}

function DungeonBranch({ id, nodeMap, visited }: BranchProps) {
  if (visited.has(id)) return null
  visited.add(id)

  const node = nodeMap.get(id)
  if (!node) return null

  const children = node.conexiones
    .map((cid) => nodeMap.get(cid))
    .filter((n): n is DungeonNode => Boolean(n))

  return (
    <div className="flex items-center">
      <DungeonNodeCard node={node} />

      {children.length > 0 && (
        <>
          {/* Conector horizontal entre el nodo y sus hijos */}
          <div className="h-0.5 w-6 shrink-0 bg-border" aria-hidden />

          <div className="flex flex-col gap-3">
            {children.map((child, idx) => (
              <div key={child.id} className="flex items-center">
                {/* Marcador vertical cuando hay multiples ramas */}
                {children.length > 1 && (
                  <div
                    className={`mr-2 w-0.5 shrink-0 bg-border ${
                      idx === 0 ? "h-1/2 self-end" : idx === children.length - 1 ? "h-1/2 self-start" : "h-full"
                    }`}
                    style={{ minHeight: 24 }}
                    aria-hidden
                  />
                )}
                <DungeonBranch id={child.id} nodeMap={nodeMap} visited={visited} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
