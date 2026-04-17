'use client'

import StubPage from '~/widgets/stub-page/stub-page'
import { IconReport } from '~packages/ui/icons'

export default function ReportsPage() {
	return (
		<StubPage
			icon={<IconReport size={34} />}
			title="Отчёты"
			description="Все шорт-листы актёров, сформированные для ваших кастингов. Удобный обзор и быстрая отправка заказчику."
			features={[
				'Список всех созданных отчётов',
				'Статус каждого отчёта',
				'Быстрый переход к актёрам внутри',
				'Поделиться отчётом по ссылке',
				'Фильтры по кастингу и дате',
			]}
			accentColor="#22c55e"
			backHref="/dashboard"
		/>
	)
}
