'use client'

import StubPage from '~/widgets/stub-page/stub-page'
import { IconBell } from '~packages/ui/icons'

export default function NotificationsPage() {
	return (
		<StubPage
			icon={<IconBell size={34} />}
			title="Уведомления"
			description="Центр уведомлений о новых кастингах, откликах, изменениях в проектах и важных системных событиях."
			features={[
				'Лента всех уведомлений',
				'Фильтр: новые, прочитанные, по типу',
				'Настройки каналов: push, email, в приложении',
				'Уведомления о новых кастингах и откликах',
				'Системные оповещения об аккаунте',
			]}
			accentColor="#f59e0b"
		/>
	)
}
