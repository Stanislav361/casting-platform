import { IListActor, UseActors } from '../actor'
import { z } from 'zod'

import {
	Branded,
	InjectProps,
	ListResponse,
	UseModelOptions,
} from '@prostoprobuy/types'

import {
	ProducerReportSchema,
	ReadonlyProducerReportActorSchema,
	ReadonlyProducerReportListActorSchema,
	ReadonlyReportActorSchema,
	ReadonlyReportSchema,
	WriteableReportActorSchema,
	WriteableReportSchema,
} from './report.schema'

export type ReportID = Branded<number, 'ReportID'>

export type ReportPublicID = Branded<string, 'ReportPublicID'>

export type IReport = z.infer<typeof ReadonlyReportSchema>

export type IProducerReport = z.infer<typeof ProducerReportSchema>

export type ICreateReport = z.infer<typeof WriteableReportSchema>

export type IUpdateReport = Partial<z.infer<typeof WriteableReportSchema>>

export type IReportActor = z.infer<typeof ReadonlyReportActorSchema>

export type IProducerReportListActor = z.infer<
	typeof ReadonlyProducerReportListActorSchema
>

export type IProducerReportActor = z.infer<
	typeof ReadonlyProducerReportActorSchema
>

export type IWriteableReportActor = z.infer<typeof WriteableReportActorSchema>

export type WithReportID = InjectProps<'report', ReportID>

export type WithReport = InjectProps<'report', IReport>

export type WithReportPublicID = InjectProps<'report', ReportPublicID>

export type WithProducerReport = InjectProps<'report', IProducerReport>

export type WithReportActor = InjectProps<'actor', IReportActor>

export type WithProducerReportListActor = InjectProps<
	'actor',
	IProducerReportListActor
>

export type WithProducerReportActor = InjectProps<'actor', IProducerReportActor>

export type IFullReport = IReport & {
	actors: ListResponse<IListActor>
}

export type ProducerReportActorResponse = IProducerReport & {
	actors: ListResponse<IProducerReportListActor>
}

export type IProducerReportFavorite = {
	actor_id: number
}

export type UseReports = UseModelOptions<'title' | 'created_at'> & {
	casting_id: number
	via_casting: boolean
	min_created_at: string
	max_created_at: string
}

export type UseReportActors = UseActors & {
	via_casting: boolean
}

export type UseProducerReportActors = UseActors & {
	favorite: boolean
}
