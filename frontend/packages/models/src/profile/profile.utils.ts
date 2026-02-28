import { ReactNode } from 'react'

import { ImageType } from '@prostoprobuy/types'

import { IReadonlyProfileImage, ProfileID } from './profile.types'

export const toProfileID = (id: number | string): ProfileID =>
	Number(id) as ProfileID

export const getProfileImage = (
	images: IReadonlyProfileImage[],
	image_type: ImageType,
	callback: (image?: IReadonlyProfileImage) => ReactNode,
) => callback(images?.find(image => image.image_type === image_type))

export const getOtherProfileImages = (images: IReadonlyProfileImage[]) =>
	images?.filter(image => image.image_type === ImageType.other)

export const existsOtherProfileImage = (images: IReadonlyProfileImage[]) =>
	images?.some(image => image.image_type === ImageType.other)
