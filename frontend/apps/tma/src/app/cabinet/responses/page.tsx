'use client'

import StubPage from '~/widgets/stub-page/stub-page'
import { IconSend } from '~packages/ui/icons'

export default function ResponsesPage() {
	return (
		<StubPage
			icon={<IconSend size={34} />}
			title="Мои отклики"
			description="Все кастинги, на которые вы откликнулись своими актёрами, с отслеживанием статусов."
			features={[
				'Список всех активных откликов',
				'Статус каждого актёра: рассмотрение, принят, резерв',
				'История откликов за всё время',
				'Быстрый переход к кастингу и чату',
				'Фильтры по статусу и дате',
			]}
			accentColor="#3b82f6"
			backHref="/cabinet"
		/>
	)
}
