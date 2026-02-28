'use client'

import { IconFilterFilled, IconRestore, IconX } from '@tabler/icons-react'
import {
	PropsWithChildren,
	useCallback,
	useEffect,
	useLayoutEffect,
	useState,
} from 'react'
import { undefined } from 'zod'

import { useDeviceDetect } from '~packages/hooks'
import { Button, Drawer, Flex, Tooltip } from '~packages/ui'

import { useModal } from '@prostoprobuy/hooks'
import { CastingStatus, UseCastings } from '@prostoprobuy/models'
import { Dictionary } from '@prostoprobuy/types'

export type FilterDrawerKeyof<T extends Dictionary<any>> = Record<
	keyof Partial<T>,
	string
>

export type FilterDrawerMap<T extends Dictionary<any>> = Partial<
	Record<keyof T, (val: any) => string | Promise<string>>
>

interface FilterDrawerProps<T extends Dictionary<any>>
	extends PropsWithChildren {
	view?: ButtonView
	fields?: Partial<T>
	excludeFields?: string[]
	parseFields?: Record<keyof Partial<T>, any>
	setter?: (fields: Dictionary<any>) => void
	reset?: () => void
	inline?: boolean
	renderValueMap?: FilterDrawerMap<T>
	onRemove?: (key: keyof T) => void
}

const filterExclude = <T extends Dictionary<any>>(
	fields: T = {} as T,
	excludeFields: string[] = [],
) => {
	if (!excludeFields || !fields) {
		return fields
	}

	return Object.keys(fields).reduce((acc, key) => {
		if (excludeFields.includes(key)) {
			return acc
		}
		return { ...acc, [key]: fields[key] }
	}, {})
}

const EXCLUDE_VALUES = [CastingStatus.not_closed] as string[]

export const filterDrawerSetter = ({
	key,
	setter,
}: {
	key?: string
	setter?: (fields: Dictionary<any>) => void
}) => {
	setter &&
		setter({
			[key]: key === 'status' ? CastingStatus.not_closed : '',
		})
}

const RenderValue = ({
	fn,
	value,
}: {
	fn: (val: any) => string | Promise<string>
	value: any
}) => {
	const [resolved, setResolved] = useState<string>('')

	useEffect(() => {
		let active = true

		Promise.resolve(fn(value)).then(res => {
			if (active) setResolved(res)
		})

		return () => {
			active = false
		}
	}, [fn, value])

	return <>{resolved}</>
}

export const FilterDrawerApplied = <T extends Dictionary<any>>({
	parseFields,
	onRemove,
	renderValueMap,
	fields,
	excludeFields,
}: FilterDrawerProps<T>) => {
	const [store, setStore] = useState<Partial<T>>(
		filterExclude(fields, excludeFields),
	)

	useLayoutEffect(() => {
		setStore(filterExclude(fields, excludeFields))
	}, [fields, excludeFields])

	return (
		<Flex alignItems={'center'} gap={10} flexWrap={'wrap'}>
			{Object.entries(store).map(([key, value]) =>
				value && !EXCLUDE_VALUES.includes(value as string) ? (
					<Button
						view='overlay'
						onClick={() => onRemove?.(key as keyof T)}
					>
						<IconX />
						{parseFields?.[key as keyof T]}{' '}
						{renderValueMap?.[key as keyof T] ? (
							<RenderValue
								fn={renderValueMap[key as keyof T]!}
								value={value}
							/>
						) : (
							value
						)}
					</Button>
				) : null,
			)}
		</Flex>
	)
}

export const FilterDrawer = <T extends Dictionary<any>>({
	children,
	fields,
	setter,
	view,
	parseFields,
	excludeFields,
	inline,
	renderValueMap,
	reset,
}: FilterDrawerProps<T>) => {
	const { isMobile } = useDeviceDetect()

	const [store, setStore] = useState<Partial<T>>(
		filterExclude(fields, excludeFields),
	)
	const { isOpen, open, close } = useModal()

	useLayoutEffect(() => {
		setStore(filterExclude(fields, excludeFields))
	}, [fields, excludeFields])

	const memoSetter = useCallback(
		(key: string) => {
			filterDrawerSetter({
				setter,
				key,
			})
		},
		[setter],
	)

	return (
		<Flex gap={16} width={isMobile && '100%'}>
			{isOpen && (
				<Drawer isOpen={isOpen} onClose={close}>
					<Drawer.Header
						action={
							reset && (
								<Button view={view} onClick={reset}>
									<IconRestore size={18} />
									Сбросить
								</Button>
							)
						}
					>
						Фильтры
					</Drawer.Header>
					<Drawer.Body>{children}</Drawer.Body>
				</Drawer>
			)}
			<Button view={view} onClick={open} width={isMobile && 'max'}>
				<IconFilterFilled size={16} />
				Фильтры
			</Button>
			{reset && (
				<Tooltip label={'Сбросить фильтры'}>
					<Button
						view={view}
						onClick={reset}
						width={isMobile && 'max'}
					>
						<IconRestore size={18} />
						Сбросить
					</Button>
				</Tooltip>
			)}
			{store && !inline && (
				<FilterDrawerApplied
					fields={fields}
					excludeFields={excludeFields}
					parseFields={parseFields}
					renderValueMap={renderValueMap}
					excludeValues={EXCLUDE_VALUES}
					onRemove={key => memoSetter(key)}
					onReset={reset}
					view={view}
				/>
			)}
		</Flex>
	)
}
