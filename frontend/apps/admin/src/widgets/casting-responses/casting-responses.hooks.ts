import { useUnit } from 'effector-react'

import { $responses } from '~widgets/casting-responses/casting-responses.atom'

export const useCastingResponsesStore = () => useUnit($responses)
