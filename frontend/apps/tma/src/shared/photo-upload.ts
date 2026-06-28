export const ACCEPTED_PHOTO_TYPES = 'image/*'
export const MAX_PHOTO_SIZE = 20 * 1024 * 1024

const TARGET_MAX_SIDE = 1800
const TARGET_QUALITY = 0.82
const SKIP_OPTIMIZATION_BELOW = 1.5 * 1024 * 1024

function getOutputName(name: string) {
	const base = name.replace(/\.[^.]+$/, '') || 'photo'
	return `${base}.jpg`
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file)
		const image = new Image()
		image.onload = () => {
			URL.revokeObjectURL(url)
			resolve(image)
		}
		image.onerror = () => {
			URL.revokeObjectURL(url)
			reject(new Error('Cannot read image'))
		}
		image.src = url
	})
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function optimizePhotoForUpload(file: File): Promise<File> {
	if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
	if (file.size <= SKIP_OPTIMIZATION_BELOW && file.type === 'image/jpeg') return file

	try {
		const image = await loadImageFromFile(file)
		const sourceWidth = image.naturalWidth || image.width
		const sourceHeight = image.naturalHeight || image.height
		if (!sourceWidth || !sourceHeight) return file

		const scale = Math.min(1, TARGET_MAX_SIDE / Math.max(sourceWidth, sourceHeight))
		const width = Math.max(1, Math.round(sourceWidth * scale))
		const height = Math.max(1, Math.round(sourceHeight * scale))
		const canvas = document.createElement('canvas')
		canvas.width = width
		canvas.height = height
		const ctx = canvas.getContext('2d', { alpha: false })
		if (!ctx) return file

		ctx.drawImage(image, 0, 0, width, height)
		const blob = await canvasToBlob(canvas, 'image/jpeg', TARGET_QUALITY)
		if (!blob || blob.size >= file.size) return file

		return new File([blob], getOutputName(file.name), {
			type: 'image/jpeg',
			lastModified: file.lastModified,
		})
	} catch {
		return file
	}
}
