import { nativeImage, type NativeImage } from 'electron'

/**
 * Sceau de Boris pour la barre de menus — un losange evide.
 * Encode ici plutot que charge depuis un fichier : pas de chemin a
 * resoudre entre `npm run dev` et l'application empaquetee.
 *
 * Image "template" : macOS ignore la couleur et n'utilise que l'alpha,
 * ce qui garantit la lisibilite en theme clair comme en theme sombre.
 */
const ICON_16 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAATklEQVR42mNgwA8EoJgsANJ4HooFyNX8H4pJMgRdM0mG4NJMlCHYNJ/HISZArGYBAnIENROlhmIDKPYCVQKRKtFIlYRElaRMlcxEdHYGAK43Xp1iU5gwAAAAAElFTkSuQmCC'
const ICON_32 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAi0lEQVR42tWXSw7AIAgFPRL3v5RHaDesmpgifcLUhJ06Y/zBGD9v5tEGnx7WBb88SiWe8FKJFbxE4g1+VCIKPyKxC5dKZOESiQh8BvvYKbht9pXDv4yRwWUSilWk51DuY2qudoH2LUAcQsQ1RDxEiKcY8RkhvmNEQoJIyRBJKSItRxQmiNIMUZxK2g1ewnCoJMPwEAAAAABJRU5ErkJggg=='

export function trayIcon(): NativeImage {
  const img = nativeImage.createEmpty()
  img.addRepresentation({ scaleFactor: 1, dataURL: ICON_16 })
  img.addRepresentation({ scaleFactor: 2, dataURL: ICON_32 })
  img.setTemplateImage(true)
  return img
}
