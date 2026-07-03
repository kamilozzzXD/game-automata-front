import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Cauldron } from "../components/game/Cauldron"
import { loadImage } from "../utils/assetLoader"
import spritesheetUrl from "../assets/character-spritesheet.png"
import { Portal } from "../components/game/Portal"

import { CraftingModal } from "../components/ui/CraftingModal"
import { HUD } from "../components/ui/HUD"
import { MobileHUD } from "../components/ui/MobileHUD"
import { Notifications } from "../components/ui/Notifications"
import { useGameStore } from "../core/gameStore"
import { isWithinRadius } from "../core/geometry"
import type { Interactable, Size } from "../types/game"
import { useGameKeyboard } from "../hooks/useGameKeyboard"
import { useHotbarControls } from "../hooks/useHotbarControls"
import { usePlayerMovement } from "../hooks/usePlayerMovement"
import { useCanvasLoop } from "../hooks/useCanvasLoop"
import { useMobileDetection } from "../hooks/useMobileDetection"
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

const GRID_SIZE = 40
const SPRITE_SIZE = 64 // LPC frame: 64×64 px

export function ForestScene() {
  const playerPosition = useGameStore((s) => s.playerPosition)
  const setPlayerPosition = useGameStore((s) => s.setPlayerPosition)

  // Ref a la textura del jugador (evita drawImage con string crudo)
  const playerSpriteRef = useRef<HTMLImageElement | null>(null)
  useEffect(() => {
    loadImage(spritesheetUrl).then((img) => { playerSpriteRef.current = img })
  }, [])
  const isCraftingOpen = useGameStore((s) => s.isCraftingOpen)
  const openCrafting = useGameStore((s) => s.openCrafting)

  // Estado de la mazmorra (Sprint 3 / 3.1: ahora cambia de escena)
  const isGeneratingDungeon = useGameStore((s) => s.isGeneratingDungeon)
  const setIsGeneratingDungeon = useGameStore((s) => s.setIsGeneratingDungeon)
  const setCurrentDungeon = useGameStore((s) => s.setCurrentDungeon)
  const setCurrentScene = useGameStore((s) => s.setCurrentScene)
  const pushNotification = useGameStore((s) => s.pushNotification)

  const { isMobile } = useMobileDetection()

  // Pausamos el movimiento mientras se carga la mazmorra o el modal de crafteo esta abierto.
  const movementEnabled = !isCraftingOpen && !isGeneratingDungeon
  const keysRef = useGameKeyboard(movementEnabled)

  // Hotbar (Sprint 4): activo siempre que no haya un modal bloqueante.
  // En el claro del bosque, las pociones no deben ser consumidas ni usadas.
  useHotbarControls({
    enabled: movementEnabled,
    allowUse: false,
    onUsePotion: () => { },
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

  // Dibujo de un pino en el lienzo para Y-Sorting.
  const drawPineTree = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save()
    // Tronco del árbol
    ctx.fillStyle = "#451a03"
    ctx.fillRect(x + size / 2 - 3, y + size - 16, 6, 16)

    // Hojas del pino (3 capas triangulares)
    ctx.fillStyle = "#022c22"
    ctx.strokeStyle = "#064e3b"
    ctx.lineWidth = 1.5

    const layersCount = 3
    const layerHeight = (size - 12) / layersCount
    for (let l = 0; l < layersCount; l++) {
      const ly = y + size - 12 - (l * layerHeight * 0.7)
      const lw = size * (1 - l * 0.25)
      ctx.beginPath()
      ctx.moveTo(x + size / 2 - lw / 2, ly)
      ctx.lineTo(x + size / 2, ly - layerHeight)
      ctx.lineTo(x + size / 2 + lw / 2, ly)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }

  // Dibujo del caldero en el lienzo para Y-Sorting.
  const drawCauldron = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, isPlayerNear: boolean) => {
    ctx.save()
    // Olla del caldero
    ctx.fillStyle = "#1e293b"
    ctx.strokeStyle = isPlayerNear ? "rgba(16, 185, 129, 0.8)" : "#0f172a"
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(x + w / 2, y + h / 2 + 6, w * 0.38, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Borde superior
    ctx.fillStyle = "#334155"
    ctx.beginPath()
    ctx.ellipse(x + w / 2, y + h / 2 - 12, w * 0.35, h * 0.1, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Poción hirviendo verde
    ctx.fillStyle = "#10b981"
    ctx.beginPath()
    ctx.ellipse(x + w / 2, y + h / 2 - 12, w * 0.32, h * 0.08, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // Burbujas animadas
    const time = performance.now()
    ctx.fillStyle = "#a7f3d0"
    for (let i = 0; i < 3; i++) {
      const bx = x + w / 2 - 12 + ((i * 14 + time / 20) % 24)
      const by = y + h / 2 - 12 + Math.sin(time / 150 + i) * 2
      ctx.beginPath()
      ctx.arc(bx, by, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // Dibujo del portal en el lienzo para Y-Sorting.
  const drawPortal = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, isPlayerNear: boolean) => {
    ctx.save()
    const cx = x + w / 2
    const cy = y + h / 2
    
    // Vórtice espiral animado
    const time = performance.now()
    const rotation = time / 1000
    ctx.translate(cx, cy)
    ctx.rotate(rotation)

    const radius = isPlayerNear ? w * 0.5 : w * 0.42
    const gradVortex = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
    gradVortex.addColorStop(0, "#ffffff")
    gradVortex.addColorStop(0.3, "#a855f7")
    gradVortex.addColorStop(0.8, "#6366f1")
    gradVortex.addColorStop(1, "rgba(15, 23, 42, 0)")

    ctx.fillStyle = gradVortex
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  // Dibujo del lienzo base + Y-Sorting en Canvas.
  const drawForest = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Paso 1: Fondo y rejilla
    const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7)
    bg.addColorStop(0, "#047857")
    bg.addColorStop(0.55, "#065f46")
    bg.addColorStop(1, "#022c22")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // Rejilla técnica de 40px
    ctx.strokeStyle = "rgba(0, 0, 0, 0.12)"
    ctx.lineWidth = 0.5
    for (let x = 0; x <= w; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
    }
    for (let y = 0; y <= h; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }

    const state = useGameStore.getState()
    const isNearPortal = isWithinRadius(
      state.playerPosition,
      PLAYER_SIZE,
      PORTAL.position,
      PORTAL.size,
      PORTAL.interactionRadius
    )
    const isNearCauldron = isWithinRadius(
      state.playerPosition,
      PLAYER_SIZE,
      CAULDRON.position,
      CAULDRON.size,
      CAULDRON.interactionRadius
    )

    // Paso 2: Suelo (Camino de tierra y sombras en el piso)
    // Camino de tierra hacia el caldero
    ctx.save()
    ctx.fillStyle = "rgba(252, 211, 77, 0.15)"
    ctx.filter = "blur(12px)"
    ctx.beginPath()
    ctx.ellipse(380 + 380 / 2, 230 + 80 / 2, 380 / 2, 80 / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Sombras de los árboles
    ctx.save()
    ctx.fillStyle = "rgba(2, 6, 23, 0.25)"
    TREES.forEach((t) => {
      const size = t.size ?? 60
      ctx.beginPath()
      ctx.ellipse(t.x + size / 2, t.y + size - 4, size * 0.4, size * 0.1, 0, 0, Math.PI * 2)
      ctx.fill()
    })

    // Sombra del caldero
    ctx.beginPath()
    ctx.ellipse(
      CAULDRON.position.x + CAULDRON.size.width / 2,
      CAULDRON.position.y + CAULDRON.size.height - 6,
      CAULDRON.size.width * 0.45,
      CAULDRON.size.height * 0.15,
      0, 0, Math.PI * 2
    )
    ctx.fill()

    // Sombra del jugador
    ctx.beginPath()
    ctx.ellipse(
      state.playerPosition.x + PLAYER_SIZE.width / 2,
      state.playerPosition.y + PLAYER_SIZE.height - 2,
      14,
      5,
      0,
      0,
      Math.PI * 2
    )
    ctx.fill()
    ctx.restore()

    // Paso 3: Y-Sorting dinámico (Árboles, Portal, Caldero y Jugador)
    type Renderable = {
      yBase: number
      draw: () => void
    }
    const renderables: Renderable[] = []

    // Árboles
    TREES.forEach((t) => {
      const size = t.size ?? 60
      renderables.push({
        yBase: t.y + size - 4,
        draw: () => drawPineTree(ctx, t.x, t.y, size)
      })
    })

    // Caldero
    renderables.push({
      yBase: CAULDRON.position.y + CAULDRON.size.height,
      draw: () => drawCauldron(ctx, CAULDRON.position.x, CAULDRON.position.y, CAULDRON.size.width, CAULDRON.size.height, isNearCauldron)
    })

    // Portal
    renderables.push({
      yBase: PORTAL.position.y + PORTAL.size.height,
      draw: () => drawPortal(ctx, PORTAL.position.x, PORTAL.position.y, PORTAL.size.width, PORTAL.size.height, isNearPortal)
    })

    // Jugador
    renderables.push({
      yBase: state.playerPosition.y + PLAYER_SIZE.height,
      draw: () => {
        let row = 10
        if (Math.abs(state.lastDirection.x) > Math.abs(state.lastDirection.y)) {
          row = state.lastDirection.x > 0 ? 11 : 9
        } else {
          row = state.lastDirection.y < 0 ? 8 : 10
        }
        const frameIndex = state.isPlayerMoving ? Math.floor(performance.now() / 80) % 9 : 0

        if (playerSpriteRef.current) {
          ctx.save()
          ctx.globalAlpha = state.isPlayerInvisible ? 0.4 : 1
          ctx.drawImage(
            playerSpriteRef.current,
            frameIndex * SPRITE_SIZE, row * SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE,
            state.playerPosition.x - 8, state.playerPosition.y - 12, SPRITE_SIZE, SPRITE_SIZE,
          )
          ctx.restore()
        }
      }
    })

    // Ordenar y ejecutar dibujado secuencial
    renderables.sort((a, b) => a.yBase - b.yBase)
    renderables.forEach((r) => r.draw())
  // playerSpriteRef es un ref estable; no va en deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canvasRef = useCanvasLoop({ width: WORLD_SIZE.width, height: WORLD_SIZE.height, draw: drawForest, isMobile })

  return (
    <div
      className="relative overflow-hidden rounded-2xl border-2 border-border shadow-2xl bg-background"
      style={{ width: WORLD_SIZE.width, height: WORLD_SIZE.height }}
    >
      {/* Canvas base: fondo + rejilla 40px en z-0 (capa inferior absoluta) */}
      <canvas ref={canvasRef} className="absolute inset-0" style={{ zIndex: 0 }} aria-hidden />

      {/* Portal hacia la mazmorra (lado izquierdo del claro) */}
      <Portal
        position={PORTAL.position}
        size={PORTAL.size}
        isPlayerNear={isPlayerNearPortal}
        isBusy={isGeneratingDungeon}
        onlyOverlay={true}
      />

      {/* Caldero */}
      <Cauldron
        position={CAULDRON.position}
        size={CAULDRON.size}
        isPlayerNear={isPlayerNearCauldron}
        onlyOverlay={true}
      />



      {/* El jugador se dibuja directamente en el canvas (ver drawForest) */}

      {/* HUD superpuesto (incluye el inventario y la PotionHotbar
          apilados en la columna izquierda - Sprint Polish-Pass T1). */}
      <HUD />
      <MobileHUD />

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
  )
}
