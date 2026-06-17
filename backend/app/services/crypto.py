import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.config import settings

class CryptoService:
    def __init__(self):
        try:
            key_bytes = base64.b64decode(settings.vault_master_key)
            if len(key_bytes) != 32:
                key_bytes = key_bytes.ljust(32, b'\0')[:32]
        except Exception:
            key_bytes = settings.vault_master_key.encode('utf-8').ljust(32, b'\0')[:32]
        
        self.aesgcm = AESGCM(key_bytes)

    def encrypt(self, plaintext: str) -> bytes:
        """Cifra un texto plano y retorna bytes (nonce + ciphertext)."""
        if not plaintext:
            return b""
        nonce = os.urandom(12)  # 12 bytes nonce estándar para AES-GCM
        ciphertext = self.aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
        return nonce + ciphertext

    def decrypt(self, encrypted_data: bytes) -> str:
        """Descifra los bytes y retorna el texto plano."""
        if not encrypted_data:
            return ""
        try:
            nonce = encrypted_data[:12]
            ciphertext = encrypted_data[12:]
            decrypted = self.aesgcm.decrypt(nonce, ciphertext, None)
            return decrypted.decode('utf-8')
        except Exception as e:
            raise ValueError(f"Error al descifrar: {str(e)}")

crypto_service = CryptoService()
