import { Button, Radio } from '@telegram-apps/telegram-ui'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useInfinityCities } from '~models/city'

import { DataObserverLoader } from '~packages/lib'
import {
	Flex,
	Input,
	InputButton,
	Modal,
	ModalContent,
	ScrollContainer,
	Sheet,
	Spacing,
} from '~packages/ui'

import { useDebounce, useMemoizedFn, useToggle } from '@prostoprobuy/hooks'
import { CityFullName, ICity } from '@prostoprobuy/models'
import { Nullable } from '@prostoprobuy/types'

interface CitySelectProps {
	selected?: CityFullName
	onSelect: (city: CityFullName) => void
	error?: boolean | string
}

export const CitySelect = ({ selected, onSelect, error }: CitySelectProps) => {
	const [search, setSearch] = useState('')
	const [selectedCity, setSelectedCity] =
		useState<Nullable<CityFullName>>(selected)
	const [city, setCity] = useState<Nullable<CityFullName>>(selected)

	const [val, toggle] = useToggle(false)

	const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
		useInfinityCities({
			search,
			page_size: 25,
			page_number: 1,
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
			toggle()
		},
		[onSelect, toggle],
	)

	const handleSelect = useMemoizedFn((city: ICity) => {
		setSelectedCity(city.full_name)
	})

	const searchHandler = useDebounce((e: any) => {
		setSearch(e.target.value)
	})

	return (
		<>
			<InputButton onClick={toggle} error={error}>
				{city ? city : 'Не выбрано'}
			</InputButton>

			<Sheet
				header={'Выбрать город'}
				onClose={toggle}
				open={val}
				height={576}
				footer={
					<Button onClick={() => handleCityChange(selectedCity)}>
						Выбрать
					</Button>
				}
			>
				<Input placeholder={'Поиск'} onChange={searchHandler} />
				<Spacing />
				<ScrollContainer height={350}>
					<Flex gap={14} flexDirection={'column'}>
						<DataObserverLoader
							hasNext={hasNextPage}
							isLoading={isLoading}
							isFetchingNext={isFetchingNextPage}
							countData={cities.length}
							effector={fetchNextPage}
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
									<Radio
										checked={c.full_name === selectedCity}
										onChange={() => handleSelect(c)}
									/>
								</Flex>
							))}
						</DataObserverLoader>
					</Flex>
				</ScrollContainer>
			</Sheet>
		</>
	)
}
