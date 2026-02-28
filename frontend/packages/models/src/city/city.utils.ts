import { CityID } from './city.types'

export const toCityID = (id: number | string): CityID => Number(id) as CityID
