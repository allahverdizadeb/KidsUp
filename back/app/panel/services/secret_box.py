from cryptography.fernet import Fernet, InvalidToken


class SecretBox:
    """Encrypts the one-time-code secret before it goes into the database (SEC-B-03).

    The key lives in the panel's environment, not in the database: a copy of the database alone (a
    backup, say) does not give the second factor of any account away. Fernet is authenticated
    encryption, so a changed value is refused rather than decrypted into something else.
    """

    def __init__(self, key: str) -> None:
        self._fernet = Fernet(key.encode())  # ValueError at start-up for a key that is not a Fernet key

    def encrypt(self, secret: str) -> str:
        return self._fernet.encrypt(secret.encode()).decode()

    def decrypt(self, token: str) -> str | None:
        """The secret, or None when the value was not encrypted with this key (rotated, tampered with)."""
        try:
            return self._fernet.decrypt(token.encode()).decode()
        except InvalidToken:
            return None
