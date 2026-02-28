'use client'

import { Alert } from '~features/shared'

import img from '~public/error_placeholder.png'

export default function AlertError() {
	return (
		<Alert
			title={'Кастинг завершен!'}
			description={
				'Присоединяйтесь к новым кастингам и воплотите свою мечту в реальность'
			}
			image={img}
		/>
	)
}
