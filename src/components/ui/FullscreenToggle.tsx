import { useEffect, useState } from "react"

/**
 * FullscreenToggle
 *
 * Botón flotante translúcido para alternar el modo de pantalla completa nativo.
 * Maneja de forma segura la compatibilidad y fallos en dispositivos como iOS Safari.
 */
export function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSupported, setIsSupported] = useState(true)

  useEffect(() => {
    const docEl = document.documentElement as any

    const hasFullscreenSupport = !!(
      docEl.requestFullscreen ||
      docEl.webkitRequestFullscreen ||
      docEl.msRequestFullscreen ||
      docEl.mozRequestFullScreen
    )

    setIsSupported(hasFullscreenSupport)

    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
        )
      )
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange)
    document.addEventListener("mozfullscreenchange", handleFullscreenChange)
    document.addEventListener("MSFullscreenChange", handleFullscreenChange)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange)
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange)
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange)
    }
  }, [])

  const toggleFullscreen = async () => {
    try {
      const docEl = document.documentElement as any
      const doc = document as any

      if (
        !document.fullscreenElement &&
        !doc.webkitFullscreenElement &&
        !doc.mozFullScreenElement &&
        !doc.msFullscreenElement
      ) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen()
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen()
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen()
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen()
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen()
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen()
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen()
        }
      }
    } catch (err) {
      // Capturar silenciosamente fallos (iOS Safari, etc)
      console.warn("Fullscreen request rejected or blocked:", err)
    }
  }

  if (!isSupported) return null

  return (
    <button
      onClick={toggleFullscreen}
      className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-background/70 text-foreground backdrop-blur transition-all duration-300 hover:border-primary/60 hover:bg-background/90 hover:scale-105 shadow-md cursor-pointer"
      title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}
      aria-label={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}
    >
      {isFullscreen ? (
        // Icono: Salir de Pantalla Completa
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        >
          <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
        </svg>
      ) : (
        // Icono: Entrar a Pantalla Completa
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        >
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      )}
    </button>
  )
}
