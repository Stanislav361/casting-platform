import { ZodType } from 'zod'

export const zodResolver = <T>(schema: ZodType<T>) => {
	return (values: any) => {
		const result = schema.safeParse(values)
		if (!result.success) {
			return result.error.flatten().fieldErrors
		}
	}
}
