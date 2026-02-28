'use client'

import { IconSearch } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useInfinityCities } from '~models/city'

import { DataObserverLoader } from '~packages/lib'
import {
	Button,
	DebounceInput,
	Flex,
	InputButton,
	Modal,
	ScrollContainer,
	Skeleton,
	Spacing,
} from '~packages/ui'

import { useDebounce, useMemoizedFn, useModal } from '@prostoprobuy/hooks'
import { CityFullName, ICity } from '@prostoprobuy/models'
import { Nullable } from '@prostoprobuy/types'

interface CitySelectProps {
	selected?: CityFullName
	onSelect: (city: CityFullName) => void
}

export const CitySelect = ({ selected, onSelect }: CitySelectProps) => {
	const [search, setSearch] = useState('')
	const [selectedCity, setSelectedCity] =
		useState<Nullable<CityFullName>>(selected)
	const [city, setCity] = useState<Nullable<CityFullName>>(selected)

	const { isOpen, open, close } = useModal()

	const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
		useInfinityCities({
			search,
			page_size: 20,
		})

	useEffect(() => {
		setCity(selected)
		setSelectedCity(selected)
	}, [selected])

	const cities: ICity[] = useMemo(
		() => data?.pages?.flatMap(p => p.response) ?? [],
		[data?.pages],
	)

	const handleCityChange = useCallback(
		(city: CityFullName) => {
			setCity(city)
			setSelectedCity(city)
			onSelect(city)
			close()
		},
		[onSelect, close],
	)

	const handleSelect = useMemoizedFn((city: ICity) => {
		setSelectedCity(city.full_name)
	})

	const searchHandler = useDebounce(e => {
		setSearch(e)
	})

	return (
		<>
			<InputButton onClick={open}>
				{city ? city : 'Не выбрано'}
			</InputButton>

			{isOpen && (
				<Modal open={isOpen} onClose={close}>
					<Modal.Header>Выберите город</Modal.Header>
					<Modal.Body>
						<DebounceInput
							value={search}
							onChange={searchHandler}
							before={<IconSearch size={18} />}
							radius={'md'}
						/>
						<Spacing />
						<ScrollContainer height={420}>
							<Flex gap={14} flexDirection={'column'}>
								<DataObserverLoader
									hasNext={hasNextPage}
									isLoading={isLoading}
									isFetchingNext={isFetchingNextPage}
									countData={cities.length}
									effector={fetchNextPage}
									loadingFallback={
										<Skeleton
											height={150}
											variant={'ellipsis'}
										/>
									}
								>
									{cities.map(c => (
										<Flex
											key={c.full_name}
											alignItems={'center'}
											justifyContent={'space-between'}
											cursor={'pointer'}
											onClick={() => handleSelect(c)}
										>
											{c.full_name}
											<input
												name={'role'}
												type={'radio'}
												value={c.full_name}
												checked={
													c.full_name === selectedCity
												}
												onChange={() => handleSelect(c)}
											/>
										</Flex>
									))}
								</DataObserverLoader>
							</Flex>
						</ScrollContainer>
					</Modal.Body>
					<Modal.Footer>
						<Button
							width={'max'}
							onClick={() => handleCityChange(selectedCity)}
						>
							Выбрать
						</Button>
					</Modal.Footer>
				</Modal>
			)}
		</>
	)
}
