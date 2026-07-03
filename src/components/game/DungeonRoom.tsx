import {
  //GiOpenTreasureChest,
  GiPortal,
  GiTorch,
} from "react-icons/gi"
import type { DungeonNodeType } from "../../types/dungeon"
import type { Size } from "../../types/game"
import amordaImg from "../../assets/amorda.png"

type Props = {
  type: DungeonNodeType
  worldSize: Size
}

/**
 * Capa de fondo + decoraciones de la habitacion actual.
 * No agrega colisiones: el jugador puede pasar por toda la zona,
 * solo cambia la AMBIENTACION segun el tipo de nodo del AST.
 */
export function DungeonRoom({ type, worldSize }: Props) {
  return (
    <>
      {/* Fondo: canvas maneja el piso; este div solo ancla el z-index */}
      <div className="absolute inset-0" aria-hidden />

      {/* Decoraciones específicas */}
      {type === "inicio" && <InicioDecor worldSize={worldSize} />}
      {type === "pasillo" && <PasilloDecor worldSize={worldSize} />}
      {type === "sala" && <SalaDecor worldSize={worldSize} />}
      {type === "jefe" && <JefeDecor worldSize={worldSize} />}
    </>
  )
}

// ---------------------------------------------------------------------------
// Decoracion: ENTRADA (nodo inicio) -- runa magica en el suelo.
// ---------------------------------------------------------------------------
function InicioDecor({ worldSize }: { worldSize: Size }) {
  return (
    <>
      <GiPortal
        className="absolute text-emerald-300/20"
        size={Math.min(worldSize.width, worldSize.height) * 0.7}
        style={{
          left: worldSize.width / 2 - (worldSize.height * 0.7) / 2,
          top: worldSize.height / 2 - (worldSize.height * 0.7) / 2,
        }}
        aria-hidden
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 240,
          height: 240,
          boxShadow: "0 0 80px 20px rgba(16, 185, 129, 0.25) inset",
        }}
        aria-hidden
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Decoracion: PASILLO -- paredes laterales y antorchas.
// (Solo es visual: NO bloquea el movimiento. La zona jugable sigue completa.)
// ---------------------------------------------------------------------------
function PasilloDecor({ worldSize }: { worldSize: Size }) {
  const wallW = 110
  return (
    <>
      {/* Paredes laterales mas oscuras para sensacion de tunel */}
      <div
        className="absolute left-0 top-0 h-full"
        style={{
          width: wallW,
          background:
            "linear-gradient(90deg, #050402 0%, rgba(5,4,2,0) 100%)",
        }}
        aria-hidden
      />
      <div
        className="absolute right-0 top-0 h-full"
        style={{
          width: wallW,
          background:
            "linear-gradient(270deg, #050402 0%, rgba(5,4,2,0) 100%)",
        }}
        aria-hidden
      />

      {/* Antorchas */}
      <GiTorch
        className="absolute text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]"
        size={42}
        style={{ left: 36, top: 80 }}
        aria-hidden
      />
      <GiTorch
        className="absolute text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]"
        size={42}
        style={{ left: 36, top: worldSize.height - 120 }}
        aria-hidden
      />
      <GiTorch
        className="absolute text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]"
        size={42}
        style={{ left: worldSize.width - 76, top: 80 }}
        aria-hidden
      />
      <GiTorch
        className="absolute text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]"
        size={42}
        style={{ left: worldSize.width - 76, top: worldSize.height - 120 }}
        aria-hidden
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Decoracion: SALA SECRETA -- cofre central como anclaje visual.
// ---------------------------------------------------------------------------
function SalaDecor({ worldSize }: { worldSize: Size }) {
  return (
    <>
      <div
        className="absolute rounded-md"
        style={{
          left: worldSize.width / 2 - 220,
          top: worldSize.height / 2 - 140,
          width: 440,
          height: 280,
          border: "2px dashed rgba(251, 191, 36, 0.25)",
          boxShadow: "0 0 60px rgba(251, 191, 36, 0.08) inset",
        }}
        aria-hidden
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Decoracion: JEFE -- calaveras + iluminacion roja pulsante.
// ---------------------------------------------------------------------------
function JefeDecor({ worldSize }: { worldSize: Size }) {
  const corners = [
    { left: worldSize.width - 144, top: worldSize.height - 144 },
  ]
  return (
    <>
      {/* Halo rojo pulsante */}
      <div
        className="absolute inset-0 animate-pulse"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(220, 38, 38, 0.18) 0%, transparent 60%)",
        }}
        aria-hidden
      />

      {corners.map((c, i) => (
        <img
          key={i}
          src={amordaImg}
          alt="Decoración Amorda"
          className="absolute drop-shadow-[0_0_10px_rgba(220,38,38,0.7)] object-contain"
          style={{
            ...c,
            width: "120px",
            height: "120px",
          }}
          aria-hidden
        />
      ))}
    </>
  )
}
