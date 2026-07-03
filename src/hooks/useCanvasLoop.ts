import { useEffect, useRef } from "react"

interface UseCanvasLoopProps {
  width: number
  height: number
  /** Función de dibujo invocada en cada frame del bucle rAF. */
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  /** Opcional: indica si es un dispositivo móvil para degradación gráfica */
  isMobile?: boolean
}

/**
 * useCanvasLoop
 *
 * Encapsula el ciclo requestAnimationFrame sobre un <canvas> con soporte
 * High-DPI/Retina y limpieza segura de hilos al desmontar.
 *
 * Diseño anti-stale-closure: `draw` se almacena en un ref que se actualiza
 * en cada render, aislando el bucle asíncrono del ciclo de renders de React.
 *
 * @returns ref que debe asignarse al elemento <canvas> en el JSX.
 */
export function useCanvasLoop({ width, height, draw, isMobile }: UseCanvasLoopProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Ref mutable para `draw` → evita stale closures sin reiniciar el loop.
  const drawRef = useRef(draw)
  useEffect(() => { drawRef.current = draw }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Detección de dispositivo móvil autónoma si no se pasa el prop
    const isMobileDevice = isMobile !== undefined
      ? isMobile
      : typeof window !== "undefined" && (
          window.matchMedia("(pointer: coarse)").matches ||
          (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)
        )

    // Soporte High-DPI: limita dpr a un máximo de 1.25 en móviles para evitar lag en GPU.
    const dpr = isMobileDevice
      ? Math.min(window.devicePixelRatio || 1, 1.25)
      : (window.devicePixelRatio || 1)

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    let animationFrameId: number
    let frameCount = 0
    let fps = 60
    let lastFpsUpdateTime = performance.now()

    const renderLoop = () => {
      const now = performance.now()
      frameCount++

      // Actualizar el valor de FPS cada 500ms
      if (now - lastFpsUpdateTime >= 500) {
        fps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime))
        frameCount = 0
        lastFpsUpdateTime = now
      }

      // Dibujar juego
      drawRef.current(ctx, width, height)

      // Dibujar contador de FPS
      ctx.save()
      ctx.font = "bold 14px monospace"
      ctx.textBaseline = "top"
      ctx.textAlign = "left"

      if (fps > 45) {
        ctx.fillStyle = "#22c55e" // Verde
      } else if (fps > 30) {
        ctx.fillStyle = "#eab308" // Amarillo
      } else {
        ctx.fillStyle = "#ef4444" // Rojo
      }

      ctx.fillText(`FPS: ${fps}`, 10, 20)
      ctx.restore()

      animationFrameId = requestAnimationFrame(renderLoop)
    }

    renderLoop()

    // Cleanup: cancela el hilo de animación para evitar fugas de CPU.
    return () => { cancelAnimationFrame(animationFrameId) }
  }, [width, height, isMobile])

  return canvasRef
}
