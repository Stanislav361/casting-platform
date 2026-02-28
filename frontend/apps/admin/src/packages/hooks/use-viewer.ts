import { DependencyList, useEffect, useRef, useState } from 'react'
import Viewer, { Op } from 'viewerjs'

import { useMemoizedFn } from '@prostoprobuy/hooks'

type ViewerOptions = Pick<Viewer.Options, 'zoomOnWheel'>

export const useViewer = (options?: ViewerOptions, deps?: DependencyList) => {
	const [zoomValue, setZoomValue] = useState(0)
	const [isOpen, setIsOpen] = useState(false)
	const [currentIndex, setCurrentIndex] = useState(0)

	const containerRef = useRef(null)
	const viewerRef = useRef<ReturnType<Viewer>>(null)

	useEffect(() => {
		viewerRef.current = new Viewer(containerRef.current, {
			toolbar: false,
			navbar: false,
			title: true,
			movable: true,
			zoomable: true,
			rotatable: false,
			transition: true,
			scalable: false,
			toggleOnDblclick: false,
			zoomOnTouch: false,
			zIndex: 1000,
			show() {
				setIsOpen(true)
				setZoomValue(
					Math.round(viewerRef.current?.imageData?.ratio * 100),
				)
			},
			hide() {
				setIsOpen(false)
			},
			view() {
				setIsOpen(true)
			},
			viewed() {
				setIsOpen(true)
				setZoomValue(
					Math.round(viewerRef.current?.imageData?.ratio * 100),
				)
				setCurrentIndex(viewerRef.current.index)
			},

			zoom(e) {
				setZoomValue(Math.round(e.detail.ratio * 100))
			},
			...options,
		})

		return () => {
			viewerRef.current?.destroy()
		}
	}, deps)

	const openViewerAt = useMemoizedFn((index: number) => {
		viewerRef.current?.view(index)
		setCurrentIndex(index)
		setIsOpen(true)
	})

	const doNext = useMemoizedFn(() => viewerRef.current?.next())
	const doPrev = useMemoizedFn(() => viewerRef.current?.prev())
	const doZoomIn = useMemoizedFn(() => viewerRef.current?.zoom(0.1))
	const doZoomOut = useMemoizedFn(() => viewerRef.current?.zoom(-0.1))
	const doHide = useMemoizedFn(() => viewerRef.current?.hide())

	return {
		viewerRef,
		containerRef,
		zoomValue,
		isOpen,
		currentIndex,
		openViewerAt,
		doNext,
		doPrev,
		doZoomIn,
		doZoomOut,
		doHide,
	}
}
