import { IconPhotoPlus } from '@tabler/icons-react'
import { Button } from '@telegram-apps/telegram-ui'
import { useMemo } from 'react'

import { ProfileImage } from '~features/profile'

import { PROFILE_IMAGES } from '~packages/system'
import { Flex } from '~packages/ui'

import { useToggle } from '@prostoprobuy/hooks'
import {
	existsOtherProfileImage,
	IReadonlyProfileImage,
} from '@prostoprobuy/models'
import { ImageType } from '@prostoprobuy/types'

interface ProfileSelfCommonImagesProps {
	images: IReadonlyProfileImage[]
}

export default function ProfileSelfCommonImages({
	images,
}: ProfileSelfCommonImagesProps) {
	const exists = useMemo(() => existsOtherProfileImage(images), [images])

	const [val, toggle] = useToggle(exists)

	return (
		<>
			{!val && (
				<Button
					size={'m'}
					style={{ width: '100%' }}
					mode={'outline'}
					onClick={toggle}
				>
					<Flex alignItems={'center'} gap={8}>
						<IconPhotoPlus size={20} />
						Добавить еще фото
					</Flex>
				</Button>
			)}

			{val &&
				Array.from({ length: PROFILE_IMAGES }).map((_, index) => (
					<ProfileImage
						key={index}
						image_type={ImageType.other}
						id={images[index]?.id}
						src={images[index]?.photo_url}
					/>
				))}
		</>
	)
}
