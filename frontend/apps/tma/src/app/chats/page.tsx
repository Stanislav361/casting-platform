'use client'

import StubPage from '~/widgets/stub-page/stub-page'
import { IconChat } from '~packages/ui/icons'

export default function ChatsPage() {
	return (
		<StubPage
			icon={<IconChat size={34} />}
			title="Чаты"
			description="Здесь появятся ваши переписки с агентами, актёрами и командой проекта."
			features={[
				'Список всех активных чатов',
				'Чаты внутри проектов и кастингов',
				'Личные переписки с актёрами и агентами',
				'Вложения: фото, видео, файлы',
				'Уведомления о новых сообщениях',
			]}
			accentColor="#3b82f6"
		/>
	)
}
