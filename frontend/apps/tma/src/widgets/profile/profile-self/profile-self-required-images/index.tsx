import { ProfileImage } from '~features/profile'

import { getProfileImage, IReadonlyProfileImage } from '@prostoprobuy/models'
import { ImageType } from '@prostoprobuy/types'

interface ProfileSelfRequiredImagesProps {
	images: IReadonlyProfileImage[]
}

export default function ProfileSelfRequiredImages({
	images,
}: ProfileSelfRequiredImagesProps) {
	return (
		<>
			{getProfileImage(images, ImageType.portrait, image => {
				return (
					<ProfileImage
						id={image?.id}
						src={image?.photo_url}
						image_type={ImageType.portrait}
					/>
				)
			})}
			{getProfileImage(images, ImageType.side_profile, image => {
				return (
					<ProfileImage
						id={image?.id}
						src={image?.photo_url}
						image_type={ImageType.side_profile}
					/>
				)
			})}
			{getProfileImage(images, ImageType.full_body, image => {
				return (
					<ProfileImage
						id={image?.id}
						src={image?.photo_url}
						image_type={ImageType.full_body}
					/>
				)
			})}
		</>
	)
}
