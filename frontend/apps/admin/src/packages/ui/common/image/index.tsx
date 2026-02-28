'use client'

import NextImage, { type ImageLoader, type ImageProps } from 'next/image'
import { CSSProperties, useState } from 'react'

import { Skeleton } from '~packages/ui'

interface ImageProps {
	src: ImageData
	alt: string
	width?: number
	height?: number
	fill?: boolean
	disableSkeletonWidth?: boolean
	loader?: ImageLoader
	quality?: ImageProps['quality']
	priority?: ImageProps['priority']
	style?: CSSProperties
}

export const Image = ({
	src,
	width,
	height,
	alt,
	fill,
	quality,
	disableSkeletonWidth,
	priority,
	style,
}: ImageProps) => {
	const [isLoaded, setIsLoaded] = useState(false)

	const onLoad = () => {
		setIsLoaded(true)
	}

	return (
		<>
			{!isLoaded && (
				<Skeleton
					height={height}
					width={!disableSkeletonWidth && width}
				/>
			)}
			<NextImage
				src={src}
				unoptimized={true}
				width={width}
				height={height}
				alt={alt}
				onLoad={onLoad}
				quality={quality}
				fill={fill}
				priority={priority}
				style={style}
			/>
		</>
	)
}
