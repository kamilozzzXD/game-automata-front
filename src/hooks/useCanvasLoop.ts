import { useEffect, useRef } from "react"

interface UseCanvasLoopProps {
  width: number
  height: number
  /** Función de dibujo invocada en cada frame del bucle rAF. */
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
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
export function useCanvasLoop({ width, height, draw }: UseCanvasLoopProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Ref mutable para `draw` → evita stale closures sin reiniciar el loop.
  const drawRef = useRef(draw)
  useEffect(() => { drawRef.current = draw }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Soporte High-DPI: multiplica el buffer físico por el pixel-ratio.
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    let animationFrameId: number

    const renderLoop = () => {
      drawRef.current(ctx, width, height)
      animationFrameId = requestAnimationFrame(renderLoop)
    }

    renderLoop()

    // Cleanup: cancela el hilo de animación para evitar fugas de CPU.
    return () => { cancelAnimationFrame(animationFrameId) }
  }, [width, height])

  return canvasRef
}
