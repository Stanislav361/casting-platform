import {
	ReadonlyActorSchema,
	ReadonlyListActorSchema,
	zActorId,
} from '../actor'
import { zCastingId } from '../casting'
import { ImageSchema } from '../shared'
import { z } from 'zod'

import { zBrand, zSchema } from '@prostoprobuy/toolkit'

export const zReportId = zBrand(zSchema.id, 'ReportID')

export const zReportPublicId = zBrand(zSchema.id, 'ReportPublicID')

const BaseReportSchema = z.object({
	title: zSchema.title,
})

export const ReadonlyReportSchema = BaseReportSchema.extend({
	id: zReportId,
	casting_title: z.string(),
	public_id: z.string(),
	actors_via_casting: z.number(),
	actors_without_casting: z.number(),
	report_link: z.string().url(),
	created_at: zSchema.datetime,
	image: ImageSchema,
})

export const WriteableReportSchema = BaseReportSchema.extend({
	casting_id: zCastingId,
})

export const ReadonlyReportActorSchema = ReadonlyListActorSchema.extend({
	via_casting: z.boolean(),
	response_at: zSchema.datetime
})

export const WriteableReportActorSchema = z.object({
	actors_id: zActorId.array(),
})

export const ProducerReportSchema = BaseReportSchema.extend({
	id: zReportPublicId,
	updated_at: zSchema.datetime,
})

export const ReadonlyProducerReportListActorSchema =
	ReadonlyListActorSchema.extend({
		favorite: z.boolean(),
	})

export const ReadonlyProducerReportActorSchema = ReadonlyActorSchema
