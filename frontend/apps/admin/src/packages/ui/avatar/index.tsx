import { CSSProperties, memo } from 'react'

import { Image } from '~packages/ui'

interface AvatarProps {
	src: ImageData
	size?: number
	borderRadius?: CSSProperties['borderRadius']
}

export const Avatar = memo(
	({ src, borderRadius = '50%', size = 42 }: AvatarProps) => (
		<picture
			style={{
				borderRadius,
				width: size,
				height: size,
				overflow: 'hidden',
				border: '1px solid #0000001A',
				background: 'var(--color-overlay)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				flexShrink: 0,
			}}
		>
			<Image
				src={src}
				width={size}
				height={size}
				style={{ width: size, height: size }}
				alt={''}
			/>
		</picture>
	),
)
