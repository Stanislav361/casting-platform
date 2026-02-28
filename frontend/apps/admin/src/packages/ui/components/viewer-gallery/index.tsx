import {
	IconChevronLeft,
	IconChevronRight,
	IconX,
	IconZoomIn,
	IconZoomOut,
} from '@tabler/icons-react'
import { PropsWithChildren } from 'react'
import { createPortal } from 'react-dom'

import styles from './index.module.scss'

interface ViewerGalleryProps extends PropsWithChildren {
	length: number
	currentIndex: number
	zoomValue: number
	doHide: () => voi
	doPrev: () => void
	doNext: () => void
	doZoomIn: () => void
	doZoomOut: () => void
}

export const ViewerGallery = ({
	currentIndex,
	zoomValue,
	doZoomIn,
	doZoomOut,
	doPrev,
	doNext,
	doHide,
	length,
	children,
}: ViewerGalleryProps) => {
	return createPortal(
		<>
			{currentIndex > 0 && (
				<div onClick={doPrev} className={styles.refActorGalleryLeft}>
					<IconChevronLeft size={24} />
				</div>
			)}
			{currentIndex < length - 1 && (
				<div onClick={doNext} className={styles.refActorGalleryRight}>
					<IconChevronRight size={24} />
				</div>
			)}
			<div className={styles.refActorGallery}>
				<div className={styles.refActorGalleryNames}>{children}</div>
			</div>
			<div className={styles.refActorGalleryZoom}>
				<div onClick={doZoomIn}>
					<IconZoomIn size={24} />
				</div>
				<span>{zoomValue || 0}%</span>
				<div onClick={doZoomOut}>
					<IconZoomOut size={24} />
				</div>
				<div onClick={doHide} className={styles.refActorGalleryExit}>
					<IconX size={24} />
				</div>
			</div>
		</>,
		document.body,
	)
}
