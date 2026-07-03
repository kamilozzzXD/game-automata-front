import { useEffect, useState } from "react"
import { debounce } from "../utils/debounce"

/**
 * useMobileDetection
 *
 * Hook para detectar si el dispositivo es móvil (pantalla táctil)
 * y si está en orientación horizontal (landscape).
 * Se actualiza de forma óptima en el evento 'resize' con debounce.
 */
export function useMobileDetection() {
  const [isMobile, setIsMobile] = useState(false)
  const [isLandscape, setIsLandscape] = useState(false)

  useEffect(() => {
    const checkDevice = () => {
      const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches
      const hasTouchPoints = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0
      
      setIsMobile(hasCoarsePointer || hasTouchPoints)
      setIsLandscape(window.innerWidth > window.innerHeight)
    }

    // Inicializar
    checkDevice()

    // Manejar resize con debounce de 100ms
    const handleResize = debounce(checkDevice, 100)

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return { isMobile, isLandscape }
}
