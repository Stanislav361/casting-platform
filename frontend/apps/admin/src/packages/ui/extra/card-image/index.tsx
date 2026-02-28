import { Image } from '~packages/ui'

import styles from './index.module.scss'

interface CardImageProps {
	src: ImageData
	alt: string
	width?: number
	height?: number
	borderRadius?: number
}

export const CardImage = ({
	src,
	alt,
	width,
	height,
	borderRadius = 16,
}: CardImageProps) => {
	return (
		<div
			className={styles.card__image}
			style={{ width, height, borderRadius }}
		>
			<Image src={src} alt={alt} width={width} height={height} />
		</div>
	)
}
