import { useUnit } from 'effector-react'

import { $responses } from '~widgets/actor-responses/actor-responses.atom'

export const useActorResponsesStore = () => useUnit($responses)
