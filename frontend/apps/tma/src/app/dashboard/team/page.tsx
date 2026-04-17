'use client'

import StubPage from '~/widgets/stub-page/stub-page'
import { IconUsers } from '~packages/ui/icons'

export default function TeamPage() {
	return (
		<StubPage
			icon={<IconUsers size={34} />}
			title="Команда"
			description="Управление сотрудниками и правами доступа внутри платформы."
			features={[
				'Список всех членов команды',
				'Добавление новых сотрудников',
				'Назначение ролей: менеджер, наблюдатель, редактор',
				'Управление правами и доступом к проектам',
				'История активности сотрудников',
			]}
			accentColor="#a855f7"
			backHref="/dashboard"
		/>
	)
}
