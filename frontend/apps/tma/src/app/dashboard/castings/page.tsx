'use client'

import StubPage from '~/widgets/stub-page/stub-page'
import { IconFilm } from '~packages/ui/icons'

export default function CastingsPage() {
	return (
		<StubPage
			icon={<IconFilm size={34} />}
			title="Кастинги"
			description="Единый список всех кастингов в системе с фильтрами и быстрыми действиями."
			features={[
				'Все кастинги одним списком',
				'Фильтры: статус, город, роль, категория',
				'Быстрый переход к откликам и отчёту',
				'Сортировка по дате и популярности',
				'Создание нового кастинга из любого проекта',
			]}
			accentColor="#14b8a6"
			backHref="/dashboard"
		/>
	)
}
