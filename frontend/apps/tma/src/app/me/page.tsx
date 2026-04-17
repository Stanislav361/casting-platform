'use client'

import StubPage from '~/widgets/stub-page/stub-page'
import { IconUser } from '~packages/ui/icons'

export default function MyProfilePage() {
	return (
		<StubPage
			icon={<IconUser size={34} />}
			title="Моя страница"
			description="Ваш личный кабинет — общий профиль, статус аккаунта и быстрый доступ к важным действиям."
			features={[
				'Основная информация об аккаунте',
				'Статистика и активность',
				'Контактные данные',
				'Мои подписки и тариф',
				'Быстрый доступ к частым действиям',
			]}
		/>
	)
}
