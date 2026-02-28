'use client'

import {
	IconArrowsMaximize,
	IconChevronLeft,
	IconChevronRight,
} from '@tabler/icons-react'
import cn from 'classnames'
import {
	CSSProperties,
	RefObject,
	useCallback,
	useEffect,
	useState,
} from 'react'

import { useDeviceDetect } from '~packages/hooks'
import { Image } from '~packages/ui'

import styles from './index.module.scss'

interface ImageSliderProps {
	defaultIndex?: number
	images: ImageData[]
	width?: CSSProperties['width']
	height?: CSSProperties['height']
	onAlbum?: (index: number) => void
	ref: RefObject<any>
}

export const ImageSlider = ({
	width,
	images,
	onAlbum,
	height,
	ref,
	defaultIndex = 0,
}: ImageSliderProps) => {
	const { isMobile } = useDeviceDetect()

	const [index, setIndex] = useState(defaultIndex)

	useEffect(() => {
		setIndex(defaultIndex)
	}, [defaultIndex])

	const goPrev = useCallback(() => {
		setIndex(i => (i - 1 + images.length) % images.length)
	}, [images.length])

	const goNext = useCallback(() => {
		setIndex(i => (i + 1) % images.length)
	}, [images.length])

	return (
		<div className={styles.slider} style={{ width, height }}>
			<div
				className={styles.slideTrack}
				style={{
					transform: `translateX(${-index * 100}%)`,
				}}
			>
				{images.map((src, i) => (
					<div key={i} className={styles.slide} ref={ref}>
						<img
							src={src}
							alt={`Разрешение`}
							draggable={false}
							onClick={() => onAlbum(index)}
						/>
					</div>
				))}
			</div>

			<div
				onClick={goPrev}
				className={cn(styles.slideAction, styles.slideLeft)}
			>
				<IconChevronLeft size={isMobile ? 16 : 24} />
			</div>

			<div
				onClick={goNext}
				className={cn(styles.slideAction, styles.slideRight)}
			>
				<IconChevronRight size={isMobile ? 16 : 24} />
			</div>

			{onAlbum && (
				<div
					onClick={() => onAlbum(index)}
					className={cn(styles.slideAction, styles.slideAlbum)}
				>
					<IconArrowsMaximize size={isMobile ? 14 : 24} />
				</div>
			)}
		</div>
	)
}
