'use client'

import StubPage from '~/widgets/stub-page/stub-page'
import { IconPortfolio } from '~packages/ui/icons'

export default function PortfolioPage() {
	return (
		<StubPage
			icon={<IconPortfolio size={34} />}
			title="Портфолио"
			description="Ваши лучшие работы: сцены из проектов, актёрские шоурилы, ссылки на опубликованные материалы."
			features={[
				'Ссылка на Showreel или агрегатор работ',
				'Список проектов, в которых снимались',
				'Фотографии со съёмок',
				'Ссылки на Instagram, Vimeo, YouTube',
				'Краткое описание карьерных достижений',
			]}
			accentColor="#14b8a6"
			backHref="/cabinet"
		/>
	)
}
