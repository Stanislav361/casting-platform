'use client'

import { IconInfoSquareRounded, IconLink } from '@tabler/icons-react'
import { List, Section, Skeleton } from '@telegram-apps/telegram-ui'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { setProfile, setProfileTab } from '~widgets/profile'
import ProfileSelfCommonImages from '~widgets/profile/profile-self/profile-self-common-images'
import ProfileSelfRequiredImages from '~widgets/profile/profile-self/profile-self-required-images'

import { WithMainButton } from '~features/shared'

import { useCastingResponse, useCastingStore } from '~models/casting'
import {
	ProfileResponse,
	useCreateResponse,
	useProfile,
	useUpdateProfile,
	useUpdateResponse,
} from '~models/profile'

import { DataLoader, tryAsync } from '~packages/lib'
import { Flex, FormContainer, Input, Notice } from '~packages/ui'

import { useForm, useMount } from '@prostoprobuy/hooks'
import { links } from '@prostoprobuy/links'
import { getOtherProfileImages } from '@prostoprobuy/models'
import { zSchema } from '@prostoprobuy/toolkit'

export default function ProfileSelf() {
	const [video_intro, setVideoIntro] = useState<string>('')
	const [video_intro_error, setVideoIntroError] = useState<string>('')

	const router = useRouter()

	const { casting, has_applied } = useCastingStore()

	const { isLoading, data } = useProfile()

	const { isLoading: isLoadingResponse } = useCastingResponse(casting)

	const create = useCreateResponse(casting)
	const update = useUpdateResponse(casting)

	const profile = useUpdateProfile()

	const { handleSubmit, register, errors, set } = useForm<ProfileResponse>({
		defaultValues: {
			casting_id: casting,
		},
	})

	useEffect(() => {
		if (!isLoading && data?.data)
			setVideoIntro(data?.data?.video_intro || '')
	}, [isLoading, data])

	useMount(() => {
		setProfileTab({
			tab: 4,
		})
	})

	const onSubmit = async (data: ProfileResponse) => {
		const parse = zSchema.url
			.optional()
			.or(z.literal(''))
			.safeParse(video_intro)

		if (!parse.success) {
			setVideoIntroError(parse.error.errors[0].message)
			return
		}

		setVideoIntroError('')

		try {
			await tryAsync(async () => {
				const intro = video_intro.trim() === '' ? null : video_intro

				setProfile({
					video_intro: intro,
				})

				await profile.mutateAsync({
					video_intro: intro,
				})

				if (!has_applied) {
					await create.mutateAsync(data)
					alert('Анкета успешно отправлена')
				} else {
					alert('Анкета успешно обновлена')
				}

				router.push(links.profile.form)
			})
		} catch {
		}
	}

	return (
		<WithMainButton
			text={'Сохранить'}
			onClick={handleSubmit(onSubmit)}
			loading={create.isPending || update.isPending}
		>
			<FormContainer title={'Фото'}>
				<Notice icon={<IconInfoSquareRounded size={18} />}>
					Загрузите 3 ваши фотографии, чтобы мы могли приложить их к
					вашей анкете
				</Notice>
			</FormContainer>

			<List>
				<DataLoader
					isLoading={isLoading}
					loadingFallback={
						<Skeleton style={{ height: 255 }} visible />
					}
				>
					<Flex
						alignItems={'center'}
						justifyContent={'space-between'}
						width={'100%'}
						gap={10}
					>
						<ProfileSelfRequiredImages images={data?.data.images} />
					</Flex>
					<Flex
						alignItems={'center'}
						justifyContent={'space-between'}
						width={'100%'}
						gap={10}
					>
						<ProfileSelfCommonImages
							images={getOtherProfileImages(data?.data.images)}
						/>
					</Flex>
				</DataLoader>
			</List>

			<FormContainer title={'Видеовизитка'}>
				<Notice icon={<IconLink size={18} />}>
					Прикрепите ссылку на видеовизитку, размещённую на облачном
					хранилище (например, Google Диск, Яндекс.Диск), чтобы мы
					могли её посмотреть.
				</Notice>
				<Section
					header='Ссылка'
					footer={video_intro_error || 'Необязательно'}
				>
					<Input
						type='url'
						placeholder=''
						disabled={isLoadingResponse}
						error={video_intro_error}
						value={video_intro}
						onChange={e => setVideoIntro(e.target.value)}
					/>
				</Section>
			</FormContainer>
		</WithMainButton>
	)
}
