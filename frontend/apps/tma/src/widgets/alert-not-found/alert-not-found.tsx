'use client'

import { Alert } from '~features/shared'

import img from '~public/casting_placeholder.png'

export default function AlertNotFound() {
	return (
		<Alert
			title={'Свет, камера, ссылка!'}
			description={
				'Для просмотра кастингов откройте приложение по специальной ссылке'
			}
			image={img}
		/>
	)
}
