'use client'

import {
	IconInfoSquareRounded,
	IconSquareRoundedCheck,
} from '@tabler/icons-react'
import { Cell, List, Section } from '@telegram-apps/telegram-ui'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'

import Header from '~widgets/header'
import { setProfile } from '~widgets/profile'

import { WithMainButton } from '~features/shared'

import { CastingImage, setCasting, WithCasting } from '~models/casting'
import { useProfile } from '~models/profile'

import { Show } from '~packages/lib'
import { Formatted, Notice } from '~packages/ui'

import { useMemoizedFn } from '@prostoprobuy/hooks'
import { links } from '@prostoprobuy/links'

export default function Casting({ casting }: WithCasting) {
	const router = useRouter()

	const { isLoading, data } = useProfile()

	const handleProfile = useMemoizedFn(() =>
		router.replace(links.profile.contact),
	)

	const text = useMemo(
		() => (casting?.has_applied ? 'Обновить' : 'Заполнить анкету'),
		[casting?.has_applied],
	)

	useEffect(() => {
		if (!isLoading && data?.data) {
			setProfile({
				...data.data,
				city: data.data.city?.full_name,
			})
		}
	}, [data?.data, isLoading])

	useEffect(() => {
		setCasting({
			casting: casting.id,
			has_applied: casting.has_applied,
		})
	}, [casting])

	return (
		<WithMainButton onClick={handleProfile} text={text}>
			<Header />
			<List>
				<CastingImage casting={casting} />
				<Section header={'Описание'}>
					<Cell multiline={true}>
						<Formatted html={casting.description} />
					</Cell>
				</Section>
				<Show
					when={casting?.has_applied}
					fallback={
						<Notice icon={<IconInfoSquareRounded size={18} />}>
							Чтобы откликнуться на этот кастинг, вам нужно
							заполнить анкету
						</Notice>
					}
				>
					<Notice icon={<IconSquareRoundedCheck size={18} />}>
						Вы уже отправляли анкету на этот кастинг, хотите
						обновить ваши данные?
					</Notice>
				</Show>
			</List>
		</WithMainButton>
	)
}
