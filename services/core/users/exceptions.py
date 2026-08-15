from fastapi import HTTPException, status


class UserException(Exception):

    UserAuthenticationError = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
    )

    @classmethod
    def get_email_already_exist_exc(cls, email) -> HTTPException:
        exc = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                'message': 'Пользователь с таким email уже существует',
                'email': email
            },
        )
        return exc

    @classmethod
    def get_tg_id_already_exist_exc(cls, tg_id) -> HTTPException:
        exc = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                'message': "Пользователь с таким telegram уже существует",
                'telegram_id': tg_id
            },
        )
        return exc

    @classmethod
    def get_tg_username_already_exist_exc(cls, tg_username) -> HTTPException:
        # `code` нужен клиенту, чтобы отличить занятый ник от других ошибок и
        # предложить сохранить остальные способы связи вместо тупика.
        exc = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                'code': 'telegram_taken',
                'message': (
                    "Этот Telegram уже привязан к другому аккаунту. Если это ваш "
                    "прежний аккаунт — войдите в него, либо укажите другой способ "
                    "связи: ВКонтакте или MAX."
                ),
                'telegram_username': tg_username
            }
        )
        return exc

    @classmethod
    def get_phone_already_exist_exc(cls, phone) -> HTTPException:
        exc = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                'code': 'phone_taken',
                'message': (
                    "Этот номер телефона уже привязан к другому аккаунту. Если это "
                    "ваш прежний аккаунт — войдите в него по этому номеру."
                ),
                'phone_number': phone
            }
        )
        return exc

    @classmethod
    def get_user_forbid_exc(cls):
        exc = HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                'message': 'This user does not have permission for this profile.'
            }
        )
        return exc


