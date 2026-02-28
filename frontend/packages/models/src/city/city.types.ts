import { z } from 'zod'

import { Branded, InjectProps, UseModelOptions } from '@prostoprobuy/types'

import { CitySchema } from './city.schema'

export type CityID = Branded<number, 'CityID'>

export type CityFullName = Branded<string, 'CityFullName'>

export type ICity = z.infer<typeof CitySchema>

export type WithCityID = InjectProps<'city', CityID>

export type WithCityFullName = InjectProps<'city', CityFullName>

export type WithCity = InjectProps<'city', ICity>

export type UseCities = UseModelOptions & {
	search: string
}
