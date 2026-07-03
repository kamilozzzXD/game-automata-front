/**
 * assetLoader.ts
 * Precarga asíncrona de imágenes mediante Promesas.
 * Evita llamadas a ctx.drawImage antes de que la textura esté lista.
 */

/**
 * Carga una imagen desde una URL y resuelve con el HTMLImageElement.
 * Rechaza si la imagen no puede cargarse.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`AssetLoader: no se pudo cargar "${src}"`))
    img.src = src
  })
}
