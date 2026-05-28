import { useState, useRef } from "react"
import { GiCauldron } from "react-icons/gi"
import cinematicaUrl from "../../assets/cinematica.mp4"

type Props = {
  onComplete: () => void
}

export function IntroCinematic({ onComplete }: Props) {
  const [step, setStep] = useState<"start" | "video">("start")
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleStart = () => {
    setStep("video")
    // Esperar al siguiente render para reproducir el video con interacción de usuario previa
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch((err) => {
          console.error("Error al reproducir el video:", err)
        })
      }
    }, 50)
  }

  const handleSkipOrEnd = () => {
    // Al saltar o finalizar, hacemos fadeout o completamos la escena
    onComplete()
  }

  if (step === "start") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black overflow-hidden select-none">
        {/* Luces mágicas de fondo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-amber-500/5 blur-[80px] pointer-events-none" />

        {/* Contenido Principal */}
        <div className="relative flex flex-col items-center text-center px-4 max-w-lg z-10 animate-fade-in">
          <div className="relative mb-6 p-4 rounded-full border border-primary/20 bg-primary/5 shadow-2xl shadow-primary/10 animate-pulse">
            <GiCauldron className="text-primary hover:rotate-12 transition-transform duration-500" size={64} />
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
            <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-amber-300 bg-clip-text text-transparent drop-shadow-sm font-sans">
              EL CALDERO
            </span>
            <br />
            <span className="text-2xl md:text-3xl font-light text-muted-foreground uppercase tracking-widest">
              del destino
            </span>
          </h1>

          <p className="text-xs text-muted-foreground/80 mb-8 max-w-sm font-medium tracking-wide">
            Una aventura interactiva impulsada por autómatas y gramáticas formales
          </p>

          <button
            onClick={handleStart}
            className="group relative flex items-center justify-center px-8 py-3.5 rounded-xl border border-primary/40 bg-gradient-to-r from-violet-600/80 to-purple-600/80 text-sm font-bold tracking-wider text-white shadow-2xl shadow-violet-500/20 backdrop-blur transition-all duration-300 hover:scale-105 hover:border-primary hover:from-violet-500 hover:to-purple-500 hover:shadow-violet-500/40"
          >
            {/* Brillo interno */}
            <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            COMENZAR LA HISTORIA
          </button>
        </div>

        {/* Firma inferior */}
        <div className="absolute bottom-6 text-[10px] tracking-wider text-muted-foreground/40 font-mono">
          PROYECTO DE AUTOMATAS Y LENGUAJES FORMALES
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-[10px] overflow-hidden">
      {/* Botón de saltar cinemática con Glassmorphism */}
      <button
        onClick={handleSkipOrEnd}
        className="pointer-events-auto absolute top-8 right-8 z-50 flex items-center gap-2 rounded-full border border-white/20 bg-black/40 backdrop-blur-md px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:bg-white/10 hover:border-white/40"
      >
        Saltar Introducción ➔
      </button>

      {/* Reproductor de Video */}
      <video
        ref={videoRef}
        src={cinematicaUrl}
        className="w-full h-full object-contain rounded-lg bg-black"
        onEnded={handleSkipOrEnd}
        autoPlay
        playsInline
      />
    </div>
  )
}
