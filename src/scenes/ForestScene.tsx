import { useCallback, useEffect, useMemo, useState } from "react"
import { GiPineTree } from "react-icons/gi"
import { Cauldron } from "../components/game/Cauldron"
import { Player } from "../components/game/Player"
import { Portal } from "../components/game/Portal"
import { IngredientItem } from "../components/game/IngredientItem"
import { CraftingModal } from "../components/ui/CraftingModal"
import { HUD } from "../components/ui/HUD"
import { Notifications } from "../components/ui/Notifications"
import { useGameStore } from "../core/gameStore"
import { POTION_NAMES, INGREDIENT_NAMES } from "../core/dictionary"
import { isWithinRadius, intersectsAABB } from "../core/geometry"
import type { Interactable, Size, PotionId, Ingredient, Vector2D } from "../types/game"
import { useGameKeyboard } from "../hooks/useGameKeyboard"
import { useHotbarControls } from "../hooks/useHotbarControls"
import { usePlayerMovement } from "../hooks/usePlayerMovement"
import { generateDungeon } from "../services/api"
import musicaForestUrl from "../assets/musica-forest.mp3"

const WORLD_SIZE: Size = { width: 960, height: 600 }
const PLAYER_SIZE: Size = { width: 48, height: 48 }

const CAULDRON: Interactable = {
  id: "cauldron-1",
  position: { x: 720, y: 220 },
  size: { width: 96, height: 96 },
  interactionRadius: 90,
}

const PORTAL: Interactable = {
  id: "portal-1",
  position: { x: 120, y: 220 },
  size: { width: 96, height: 96 },
  interactionRadius: 90,
}

// Decoracion: arboles esparcidos en el claro del bosque
const TREES = [
  { x: 40, y: 30, size: 80 },
  { x: 140, y: 480 },
  { x: 860, y: 60, size: 70 },
  { x: 30, y: 250, size: 90 },
  { x: 850, y: 480, size: 85 },
  { x: 480, y: 20, size: 60 },
  { x: 480, y: 520, size: 60 },
  { x: 250, y: 80, size: 55 },
  { x: 600, y: 470, size: 65 },
]

export function ForestScene() {
  const playerPosition = useGameStore((s) => s.playerPosition)
  const setPlayerPosition = useGameStore((s) => s.setPlayerPosition)
  const isCraftingOpen = useGameStore((s) => s.isCraftingOpen)
  const openCrafting = useGameStore((s) => s.openCrafting)

  // Estado de la mazmorra (Sprint 3 / 3.1: ahora cambia de escena)
  const isGeneratingDungeon = useGameStore((s) => s.isGeneratingDungeon)
  const setIsGeneratingDungeon = useGameStore((s) => s.setIsGeneratingDungeon)
  const setCurrentDungeon = useGameStore((s) => s.setCurrentDungeon)
  const setCurrentScene = useGameStore((s) => s.setCurrentScene)
  const pushNotification = useGameStore((s) => s.pushNotification)
  const addIngredient = useGameStore((s) => s.addIngredient)



  // Pausamos el movimiento mientras se carga la mazmorra o el modal de crafteo esta abierto.
  const movementEnabled = !isCraftingOpen && !isGeneratingDungeon
  const keysRef = useGameKeyboard(movementEnabled)

  // Hotbar (Sprint 4): activo siempre que no haya un modal bloqueante.
  // En el claro del bosque, las pociones no deben ser consumidas ni usadas.
  useHotbarControls({
    enabled: movementEnabled,
    allowUse: false,
    onUsePotion: () => {},
  })

  usePlayerMovement({
    position: playerPosition,
    setPosition: setPlayerPosition,
    playerSize: PLAYER_SIZE,
    worldSize: WORLD_SIZE,
    keysRef,
    enabled: movementEnabled,
  })

  // Reproducción de música de fondo del bosque en bucle.
  // Se inicia al montar la escena del bosque y se detiene automáticamente al desmontarla.
  useEffect(() => {
    const audio = new Audio(musicaForestUrl)
    audio.loop = true
    audio.volume = 0.3 // Volumen agradable
    
    audio.play().catch((err) => {
      console.warn("La reproducción de música del bosque fue bloqueada o falló:", err)
    })

    return () => {
      audio.pause()
    }
  }, [])

  // Distancia jugador <-> caldero (matematica simple)
  const isPlayerNearCauldron = useMemo(
    () =>
      isWithinRadius(
        playerPosition,
        PLAYER_SIZE,
        CAULDRON.position,
        CAULDRON.size,
        CAULDRON.interactionRadius,
      ),
    [playerPosition],
  )

  // Distancia jugador <-> portal
  const isPlayerNearPortal = useMemo(
    () =>
      isWithinRadius(
        playerPosition,
        PLAYER_SIZE,
        PORTAL.position,
        PORTAL.size,
        PORTAL.interactionRadius,
      ),
    [playerPosition],
  )

  // Disparador del portal: llama al backend, guarda la mazmorra
  // y CAMBIA de escena al recibir respuesta exitosa (Sprint 3.1).
  async function triggerDungeon() {
    if (isGeneratingDungeon) return
    setIsGeneratingDungeon(true)
    try {
      const res = await generateDungeon()
      setCurrentDungeon(res)
      pushNotification({ kind: "info", message: res.mensaje_ui })
      setCurrentScene("dungeon")
    } catch (err) {
      console.error("[v0] Error generando mazmorra", err)
      pushNotification({
        kind: "error",
        message: "No se pudo conectar al oraculo de la mazmorra.",
      })
    } finally {
      setIsGeneratingDungeon(false)
    }
  }

  // Tecla E para interactuar (separado del movimiento porque es un evento puntual)
  const [hasFocus, setHasFocus] = useState(true)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "e") return
      if (isCraftingOpen || isGeneratingDungeon) return
      if (isPlayerNearCauldron) {
        e.preventDefault()
        openCrafting()
        return
      }
      if (isPlayerNearPortal) {
        e.preventDefault()
        void triggerDungeon()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
    // triggerDungeon depende de varios setters estables del store; no lo incluimos
    // para evitar recrear el listener en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlayerNearCauldron, isPlayerNearPortal, isCraftingOpen, isGeneratingDungeon, openCrafting])

  useEffect(() => {
    const onFocus = () => setHasFocus(true)
    const onBlur = () => setHasFocus(false)
    window.addEventListener("focus", onFocus)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("blur", onBlur)
    }
  }, [])

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-border shadow-2xl"
        style={{ width: WORLD_SIZE.width, height: WORLD_SIZE.height }}
      >
        {/* Suelo del claro: degradado verde + textura de hierba */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, #047857 0%, #065f46 55%, #022c22 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 2px, transparent 2px, transparent 8px)",
          }}
          aria-hidden
        />

        {/* Camino de tierra hacia el caldero */}
        <div
          className="absolute z-0 rounded-full bg-amber-200/15 blur-md"
          style={{ left: 380, top: 230, width: 380, height: 80 }}
          aria-hidden
        />

        {/* Decoracion: arboles */}
        {TREES.map((t, i) => (
          <GiPineTree
            key={i}
            className="absolute z-0 text-emerald-950 drop-shadow-md"
            size={t.size ?? 60}
            style={{ left: t.x, top: t.y }}
            aria-hidden
          />
        ))}

        {/* Portal hacia la mazmorra (lado izquierdo del claro) */}
        <Portal
          position={PORTAL.position}
          size={PORTAL.size}
          isPlayerNear={isPlayerNearPortal}
          isBusy={isGeneratingDungeon}
        />

        {/* Caldero */}
        <Cauldron
          position={CAULDRON.position}
          size={CAULDRON.size}
          isPlayerNear={isPlayerNearCauldron}
        />



        {/* Jugador */}
        <Player position={playerPosition} size={PLAYER_SIZE} />

        {/* HUD superpuesto (incluye el inventario y la PotionHotbar
            apilados en la columna izquierda - Sprint Polish-Pass T1). */}
        <HUD />

        {/* Aviso si la ventana no tiene foco */}
        {!hasFocus && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <p className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-card-foreground shadow-md">
              Haz clic en la ventana para jugar
            </p>
          </div>
        )}

        {/* Modales */}
        <CraftingModal />
        <Notifications />
      </div>

      
    </main>
  )
}
