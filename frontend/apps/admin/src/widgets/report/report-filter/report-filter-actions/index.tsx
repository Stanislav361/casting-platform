import { IconChevronDown, IconWashDrycleanOff } from '@tabler/icons-react'
import toast from 'react-hot-toast'

import { useDeleteReportFullActors } from '~models/report'

import { Button, Dialog, Dropdown, DropdownAction } from '~packages/ui'

import { useModal } from '@prostoprobuy/hooks'
import { WithReportID } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

import { ReportRemoveButton } from './report-remove-button'

export const ReportFilterActions = ({ report }: WithReportID) => {
	const { open, isOpen, close } = useModal()
	const req = useDeleteReportFullActors(report)

	const handleClear = async () => {
		await tryAsync(async () => {
			await req.mutateAsync(null)
			toast.success('Отчет очищен')
			close()
		})
	}

	return (
		<>
			<Dialog
				open={isOpen}
				onClose={close}
				onApply={handleClear}
				loading={req.isPending}
				applyLabel={'Очистить'}
			>
				Перед очисткой убедитесь, что выбран правильный отчет. Это
				действие приведёт к полной и необратимой очистке отчёта вместе
				со всеми содержащимися в нём данными.
			</Dialog>

			<Dropdown
				trigger={
					<Button view={'overlay'}>
						Действия <IconChevronDown size={20} />
					</Button>
				}
			>
				<ReportRemoveButton report={report} />
				<DropdownAction onClick={open} isDanger={true}>
					<IconWashDrycleanOff size={20} />
					Удалить всех
				</DropdownAction>
			</Dropdown>
		</>
	)
}
