'use client'

import { IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'

import { ICasting, useInfinityCastings } from '~models/casting'
import { CastingSelectList } from '~models/casting/ui/casting-select/casting-select-list'

import { DataObserverLoader } from '~packages/lib'
import { Input, InputButton, Relative, Skeleton } from '~packages/ui'
import { DropdownContainer } from '~packages/ui/element/drop-down/drop-down-container'

import { useDebounce, useDropDown } from '@prostoprobuy/hooks'
import { CastingID } from '@prostoprobuy/models'
import { Nullable } from '@prostoprobuy/types'

interface CastingSelectProps {
	selected?: CastingID
	error?: boolean | string
	onSelect: (casting: CastingID) => void
}

export const CastingSelect = ({
	selected,
	onSelect,
	error,
}: CastingSelectProps) => {
	const [search, setSearch] = useState('')
	const [selectedCasting, setSelectedCasting] =
		useState<Nullable<CastingID>>(null)

	const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
		useInfinityCastings({
			search,
			page_size: 25,
			page_number: 1,
			sort_by: 'created_at',
			sort_order: 'desc',
		})

	const {
		isOpenDropDown,
		toggleDropDown,
		dropdownRef,
		closeDropDown,
		triggerRef,
	} = useDropDown<HTMLDivElement, HTMLButtonElement>()

	useEffect(() => {
		setSelectedCasting(selected)
	}, [selected])

	const castings: ICasting[] = useMemo(
		() => data?.pages?.flatMap(p => p.response) ?? [],
		[data?.pages],
	)

	const selectHandler = (item: CastingID) => {
		setSelectedCasting(item)
		onSelect?.(item)
		closeDropDown()
	}

	const searchHandler = useDebounce((e: any) => {
		setSearch(e.target.value)
	})

	return (
		<Relative>
			<InputButton
				ref={triggerRef}
				onClick={toggleDropDown}
				error={error}
			>
				{selectedCasting
					? castings.find(c => c.id === selectedCasting).title
					: 'Не выбрано'}
			</InputButton>
			{isOpenDropDown && (
				<DropdownContainer ref={dropdownRef}>
					<div
						style={{
							padding: '0.375rem 0.5rem',
							position: 'sticky',
							top: '-6px',
							background: '#fff',
							zIndex: '100',
						}}
					>
						<Input
							onChange={searchHandler}
							before={<IconSearch size={18} />}
							radius={'md'}
							placeholder={'Поиск'}
						/>
					</div>

					<DataObserverLoader
						hasNext={hasNextPage}
						isLoading={isLoading}
						isFetchingNext={isFetchingNextPage}
						countData={castings.length}
						effector={fetchNextPage}
						loadingFallback={
							<Skeleton height={150} variant={'ellipsis'} />
						}
					>
						<CastingSelectList
							castings={castings}
							selected={selectedCasting}
							onSelect={selectHandler}
						/>
					</DataObserverLoader>
				</DropdownContainer>
			)}
		</Relative>
	)
}
