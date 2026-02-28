import { Image, Modal, Photo } from '~packages/ui'

import { useModal } from '@prostoprobuy/hooks'

import styles from './index.module.scss'

export const ImageView = (photo: Photo) => {
	const { isOpen, toggle, close } = useModal()

	return (
		<>
			{isOpen && (
				<Modal open={isOpen} onClose={close}>
					<Modal.Header>Просмотр фото</Modal.Header>
					<Modal.Body>
						<div className={styles.imageView}>
							<Image
								src={photo.src}
								alt={photo.alt}
								width={350}
								height={350}
							/>
						</div>
					</Modal.Body>
				</Modal>
			)}

			<picture
				onClick={toggle}
				className={styles.fixedGalleryItem}
				style={{
					width: photo.width,
					height: photo.height,
				}}
			>
				<div className={styles.fixedGalleryTag}>{photo.tag}</div>
				<Image
					src={photo.src}
					alt={photo.alt}
					width={photo.width}
					height={photo.height}
				/>
			</picture>
		</>
	)
}
