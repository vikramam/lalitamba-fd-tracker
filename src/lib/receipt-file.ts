export const GALLERY_ACCEPT =
  'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif,.pdf,.jpg,.jpeg,.png,.webp'
export const CAMERA_ACCEPT = 'image/*'

export const MAX_RECEIPT_BYTES = 50 * 1024 * 1024
export const TARGET_RECEIPT_BYTES = 3.5 * 1024 * 1024

export type PreparedReceipt = {
  file: File
  previewUrl: string | null
  originalName: string
  originalSize: number
}

export function isHeifFile(file: File) {
  const type = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  )
}

export function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function assertReceiptFile(file: File) {
  if (!file || file.size <= 0) {
    throw new Error('Choose a receipt photo.')
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    throw new Error('That file is larger than 50 MB.')
  }
  if (isPdfFile(file) || isHeifFile(file)) return
  const type = file.type.toLowerCase()
  if (
    type === 'image/jpeg' ||
    type === 'image/jpg' ||
    type === 'image/png' ||
    type === 'image/webp' ||
    type.startsWith('image/')
  ) {
    return
  }
  throw new Error('Use a photo (JPEG, PNG, WebP, HEIF) or a PDF scan.')
}

function replaceExt(name: string, ext: string) {
  return `${name.replace(/\.[^.]+$/, '') || 'receipt'}.${ext}`
}

async function blobToFile(blob: Blob, name: string, type: string) {
  return new File([blob], name, { type })
}

async function canvasToJpeg(
  source: ImageBitmap | HTMLImageElement,
  quality: number,
  maxEdge: number,
) {
  const width = 'width' in source ? source.width : 0
  const height = 'height' in source ? source.height : 0
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare the photo.')
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Could not prepare the photo.'))),
      'image/jpeg',
      quality,
    )
  })
  return blob
}

async function convertHeif(file: File): Promise<File> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      try {
        const blob = await canvasToJpeg(bitmap, 0.86, 2400)
        return blobToFile(blob, replaceExt(file.name, 'jpg'), 'image/jpeg')
      } finally {
        bitmap.close()
      }
    } catch {
      // Fall through to heic2any.
    }
  }

  const { default: heic2any } = await import('heic2any')
  const result = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.86,
  })
  const blob = Array.isArray(result) ? result[0] : result
  return blobToFile(blob, replaceExt(file.name, 'jpg'), 'image/jpeg')
}

async function loadImageSource(file: File) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return { source: bitmap, close: () => bitmap.close() }
    } catch {
      // Fall through to HTMLImageElement.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not prepare the photo.'))
      img.src = url
    })
    return { source: image, close: () => undefined }
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function compressImage(file: File): Promise<File> {
  const loaded = await loadImageSource(file)
  try {
    let blob = await canvasToJpeg(loaded.source, 0.82, 2400)
    if (blob.size > TARGET_RECEIPT_BYTES) {
      blob = await canvasToJpeg(loaded.source, 0.68, 2000)
    }
    if (blob.size > TARGET_RECEIPT_BYTES) {
      blob = await canvasToJpeg(loaded.source, 0.5, 1600)
    }
    if (
      blob.size >= file.size &&
      (file.type === 'image/jpeg' || file.type === 'image/jpg')
    ) {
      return file
    }
    return blobToFile(blob, replaceExt(file.name, 'jpg'), 'image/jpeg')
  } finally {
    loaded.close()
  }
}

export async function prepareReceiptFile(file: File): Promise<PreparedReceipt> {
  assertReceiptFile(file)
  try {
    let next = file
    if (isPdfFile(file)) {
      next = file
    } else if (isHeifFile(file)) {
      next = await convertHeif(file)
      next = await compressImage(next)
    } else {
      next = await compressImage(file)
    }

    if (next.size > MAX_RECEIPT_BYTES) {
      throw new Error('That receipt is still too large after compression.')
    }

    return {
      file: next,
      previewUrl: next.type.startsWith('image/') ? URL.createObjectURL(next) : null,
      originalName: file.name,
      originalSize: file.size,
    }
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('That')) throw cause
    if (cause instanceof Error && cause.message.startsWith('Use a')) throw cause
    if (cause instanceof Error && cause.message.startsWith('Choose')) throw cause
    throw new Error(
      isHeifFile(file)
        ? 'This iPhone photo could not be converted. Try Take photo, or export it as JPEG.'
        : 'Could not prepare that photo.',
    )
  }
}
