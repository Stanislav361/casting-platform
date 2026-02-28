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
        exc = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                'message': "Пользователь с таким telegram уже существует",
                'telegram_username': tg_username
            }
        )
        return exc

    @classmethod
    def get_phone_already_exist_exc(cls, phone) -> HTTPException:
        exc = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                'message': "Пользователь с таким номером телефона уже существует",
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


