'use client'

import { Button } from '@telegram-apps/telegram-ui'
import { useCallback, useState } from 'react'
import Cropper, { Area, Point } from 'react-easy-crop'

import { Modal, ModalContent } from '~packages/ui'

import { cropImage64 } from '@prostoprobuy/toolkit'

import styles from './index.module.scss'

interface CropImageProps {
	image?: ImageData
	aspect?: number
	setCropedImage: (image: string, area: Area) => void
	toggle: () => void
	isOpen: boolean
}

export const CropImage = ({
	image,
	toggle,
	isOpen,
	aspect,
	setCropedImage,
}: CropImageProps) => {
	const [crop, setCrop] = useState<Point>({
		x: 0,
		y: 0,
	})
	const [zoom, setZoom] = useState<number>(1)
	const [coord, setCoord] = useState<Area>({
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	})

	const onCropComplete = useCallback((_, croppedAreaPixels) => {
		setCoord(croppedAreaPixels)
	}, [])

	const cutImage = () => {
		if (!image) return

		cropImage64(
			image as unknown as string,
			coord.x,
			coord.y,
			coord.width,
			coord.height,
		).then(croppedImage => {
			setCropedImage(croppedImage, coord)
		})
	}

	const cutHandler = () => {
		cutImage()
		toggle()
	}

	if (!image) return null

	return (
		<Modal isOpen={isOpen} modalTitle={'Вырезать'} toggle={toggle}>
			<ModalContent
				action={<Button onClick={cutHandler}>Подтвердить</Button>}
			>
				<div className={styles.cropContainer}>
					<Cropper
						image={image}
						crop={crop}
						zoom={zoom}
						aspect={aspect || 1}
						onCropChange={setCrop}
						onZoomChange={setZoom}
						onCropComplete={onCropComplete}
						restrictPosition={true}
					/>
				</div>
			</ModalContent>
		</Modal>
	)
}
