'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'

import { useCreateReport, useUpdateReport } from '~models/report'

import { Button, FormRow, Input, Modal } from '~packages/ui'

import { useForm } from '@prostoprobuy/hooks'
import {
	ICreateReport,
	IUpdateReport,
	WithReport,
	WriteableReportSchema,
} from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'
import { ModalProps } from '@prostoprobuy/types'

export const ReportEditModal = ({
	report,
	open,
	onClose,
}: ModalProps<WithReport>) => {
	const req = useUpdateReport(report.id)

	const { register, handleSubmit, errors } = useForm<IUpdateReport>({
		defaultValues: {
			title: report.title,
			casting_id: report.casting_id,
		},
		resolver: zodResolver(WriteableReportSchema),
	})

	const handleUpdate = async (data: ICreateReport) => {
		await tryAsync(async () => {
			await req.mutateAsync(data)
			toast.success('Отчет успешно сохранен')
			onClose()
		})
	}

	return (
		<Modal open={open} onClose={onClose} minimal={true}>
			<Modal.Header>Изменить отчет</Modal.Header>
			<Modal.Body>
				<FormRow
					label={'Название отчета'}
					error={errors.title?.message}
					required
					withOutMargin={true}
				>
					<Input
						placeholder={'Введите название отчета'}
						error={errors.title?.message}
						{...register('title')}
					/>
				</FormRow>
			</Modal.Body>
			<Modal.Footer>
				<Button
					type={'submit'}
					view={'brand'}
					width={'max'}
					loading={req.isPending}
					onClick={handleSubmit(handleUpdate)}
				>
					Сохранить
				</Button>
			</Modal.Footer>
		</Modal>
	)
}
