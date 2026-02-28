'use client'

import { useActorViewerGallery } from '~models/actor'

import { useDeviceDetect, useViewer } from '~packages/hooks'
import { ImageSlider, ViewerGallery } from '~packages/ui'

import { WithProducerReportActor } from '@prostoprobuy/models'

export const RefActorGallery = ({ actor }: WithProducerReportActor) => {
	const { isMobile } = useDeviceDetect()

	const {
		isOpen,
		currentIndex,
		doHide,
		doPrev,
		doNext,
		doZoomIn,
		doZoomOut,
		zoomValue,
		containerRef,
		openViewerAt,
	} = useViewer(
		{
			zoomOnWheel: isMobile,
		},
		[actor.id, isMobile],
	)

	const { images, imagesUrls, ActorViewerTitleComponent } =
		useActorViewerGallery(actor, currentIndex)

	return (
		<>
			<div ref={containerRef}>
				<ImageSlider
					defaultIndex={currentIndex}
					ref={containerRef}
					width={!isMobile && 449}
					height={isMobile ? 400 : 647}
					images={imagesUrls}
					onAlbum={i => openViewerAt(i)}
				/>
			</div>
			{isOpen && (
				<ViewerGallery
					length={images.length}
					currentIndex={currentIndex}
					zoomValue={zoomValue}
					doHide={doHide}
					doPrev={doPrev}
					doNext={doNext}
					doZoomIn={doZoomIn}
					doZoomOut={doZoomOut}
				>
					{ActorViewerTitleComponent}
				</ViewerGallery>
			)}
		</>
	)
}
