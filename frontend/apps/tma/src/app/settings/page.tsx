'use client'

import StubPage from '~/widgets/stub-page/stub-page'
import { IconSettings } from '~packages/ui/icons'

export default function SettingsPage() {
	return (
		<StubPage
			icon={<IconSettings size={34} />}
			title="Настройки"
			description="Настройки профиля, безопасности, уведомлений и приватности."
			features={[
				'Персональные данные и контакты',
				'Смена пароля и привязки входа',
				'Настройки уведомлений',
				'Приватность и видимость профиля',
				'Язык и тема оформления',
				'Управление подпиской',
			]}
			accentColor="#a855f7"
		/>
	)
}
