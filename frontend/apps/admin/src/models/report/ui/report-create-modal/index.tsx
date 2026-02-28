import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'

import { CastingSelect } from '~models/casting'
import { useCreateReport } from '~models/report'

import { Button, FormRow, Input, Modal } from '~packages/ui'

import { useForm } from '@prostoprobuy/hooks'
import { ICreateReport, WriteableReportSchema } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'
import { ModalProps } from '@prostoprobuy/types'

export const ReportCreateModal = ({ open, onClose }: ModalProps) => {
	const req = useCreateReport()

	const { register, set, handleSubmit, errors } = useForm<ICreateReport>({
		defaultValues: {
			title: '',
			casting_id: undefined,
		},
		resolver: zodResolver(WriteableReportSchema),
	})

	const handleCreate = async (data: ICreateReport) => {
		await tryAsync(async () => {
			await req.mutateAsync(data)
			toast.success('Отчет успешно создан')
			onClose()
		})
	}

	return (
		<Modal open={open} onClose={onClose}>
			<Modal.Header>Новый отчет</Modal.Header>
			<Modal.Body>
				<FormRow>Настройки позиции отчета</FormRow>

				<FormRow
					label={'Название отчета'}
					error={errors.title?.message}
					required
				>
					<Input
						placeholder={'Введите название отчета'}
						error={errors.title?.message}
						{...register('title')}
					/>
				</FormRow>

				<FormRow label={'Кастинг'} required withOutMargin={true}>
					<CastingSelect
						error={errors.casting_id?.message}
						onSelect={casting => set('casting_id', casting)}
					/>
				</FormRow>
			</Modal.Body>
			<Modal.Footer>
				<Button
					type={'submit'}
					view={'brand'}
					width={'max'}
					loading={req.isPending}
					onClick={handleSubmit(handleCreate)}
				>
					Добавить
				</Button>
			</Modal.Footer>
		</Modal>
	)
}
