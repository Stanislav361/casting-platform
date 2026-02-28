import { ImageView } from '~packages/ui'

import styles from './index.module.scss'

export type Photo = {
	width: number
	height: number
	tag?: string
	src: ImageData
	alt: string
}

interface FixedGalleryProps {
	photos: Photo[]
}

export const FixedGallery = ({ photos }: FixedGalleryProps) => {
	return (
		<div className={styles.fixedGallery}>
			{photos.map(
				(photo, index) =>
					photo.src && <ImageView {...photo} key={index} />,
			)}
		</div>
	)
}
