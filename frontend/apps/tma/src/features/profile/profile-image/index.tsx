'use client'

import { IconPlus, IconTrash } from '@tabler/icons-react'
import cn from 'classnames'
import Image from 'next/image'
import { Area } from 'react-easy-crop'

import { useAddProfileImage, useDeleteProfileImage } from '~models/profile'

import { Show, tryAsync } from '~packages/lib'
import { CropImage, Spin } from '~packages/ui'

import { useFile, useToggle } from '@prostoprobuy/hooks'
import { ImageID } from '@prostoprobuy/models'
import { IMAGE_FILE_TYPES } from '@prostoprobuy/system'
import { ImageTypeMap } from '@prostoprobuy/toolkit'
import { ImageType } from '@prostoprobuy/types'

import styles from './index.module.scss'

interface ProfileImageProps {
	id?: ImageID
	src?: ImageData | string
	image_type: ImageType
}

export const ProfileImage = ({ src, id, image_type }: ProfileImageProps) => {
	const { setFile, result, file } = useFile()
	const [val, toggle] = useToggle()
	const add = useAddProfileImage()
	const remove = useDeleteProfileImage()

	const addHandler = async (_image: string, coord: Area) => {
		await tryAsync(async () => {
			await add.mutateAsync({
				image: file,
				image_type,
				x1: coord.x,
				y1: coord.y,
				x2: coord.x + coord.width,
				y2: coord.y + coord.height,
			})
		})
	}

	const changeHandler = async (e) => {
		e.preventDefault()

		if (!e.target.files) return

		const file = e.target?.files[0]

		if (!file) {
			alert('Выберите файл')
			return
		}

		await tryAsync(async () => {
			await add.mutateAsync({
				image: file,
				image_type,
				x1: 0,
				y1: 0,
				x2: 0,
				y2: 0,
			})
			alert('Фото успешно загружено')
		})
	}

	const deleteHandler = async () => {
		await tryAsync(async () => {
			await remove.mutateAsync(id)
			alert('Фото успешно удалено')
		})
	}

	return (
		<>
			{val && (
				<CropImage
					image={result}
					toggle={toggle}
					isOpen={val}
					setCropedImage={addHandler}
					aspect={2 / 3}
				/>
			)}

			<div
				className={cn(
					styles.profileImageContainer,
					image_type !== ImageType.other &&
						!src &&
						styles.profileImageContainerActive,
				)}
			>
				{!src && (
					<label htmlFor={image_type} className={styles.profileLabel}>
						<IconPlus size={18} />
						{image_type === ImageType.other
							? 'Любое интересное фото'
							: ImageTypeMap[image_type]}
						<input
							id={image_type}
							name={image_type}
							hidden={true}
							type={'file'}
							accept={IMAGE_FILE_TYPES.join(',')}
							disabled={add.isPending}
							onChange={changeHandler}
						/>
					</label>
				)}

				{src && (
					<>
						<span className={styles.profileImageContainerTag}>
							{ImageTypeMap[image_type]}
						</span>
						<span
							className={styles.profileButton}
							onClick={deleteHandler}
						>
							<Show when={!remove.isPending} fallback={<Spin />}>
								<IconTrash size={14} />
							</Show>
						</span>
						<Image src={src} alt={''} width={400} height={400} />
					</>
				)}
			</div>
		</>
	)
}
