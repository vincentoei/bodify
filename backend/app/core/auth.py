from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel
from app.core.config import get_settings
import httpx
import base64
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

security = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    id: str
    email: str | None = None
    full_name: str | None = None
    is_demo: bool = False


class SupabaseJWTVerifier:
    """Fetches Supabase JWKS and verifies ES256 (ECC P-256) JWT tokens."""

    def __init__(self, supabase_url: str):
        self.jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
        self._jwks = None
        self._public_keys = {}

    def _fetch_jwks(self):
        """Fetch JWKS from Supabase and cache public keys in PEM format."""
        response = httpx.get(self.jwks_url, timeout=10.0)
        response.raise_for_status()
        self._jwks = response.json()
        self._public_keys = {}
        for key_data in self._jwks.get("keys", []):
            kid = key_data.get("kid")
            if kid:
                self._public_keys[kid] = self._jwk_to_pem(key_data)

    @staticmethod
    def _jwk_to_pem(jwk_data: dict) -> str:
        """Convert a JWK EC key to PEM format for python-jose verification."""
        # Base64url decode x and y coordinates
        x_b64 = jwk_data["x"]
        y_b64 = jwk_data["y"]
        # Add padding if needed
        x_bytes = base64.urlsafe_b64decode(x_b64 + "=" * (4 - len(x_b64) % 4))
        y_bytes = base64.urlsafe_b64decode(y_b64 + "=" * (4 - len(y_b64) % 4))

        x_int = int.from_bytes(x_bytes, "big")
        y_int = int.from_bytes(y_bytes, "big")

        public_numbers = ec.EllipticCurvePublicNumbers(
            x_int, y_int, ec.SECP256R1()
        )
        public_key = public_numbers.public_key()

        pem_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        return pem_bytes.decode("utf-8")

    def verify(self, token: str, audience: str = "authenticated") -> dict:
        """Verify a JWT token using the appropriate key from JWKS."""
        # Get the kid from the token header
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if not kid:
            raise JWTError("Token missing 'kid' in header")

        # Refresh JWKS if kid not in cache
        if kid not in self._public_keys:
            self._fetch_jwks()

        pem = self._public_keys.get(kid)
        if not pem:
            raise JWTError(f"Key '{kid}' not found in JWKS")

        return jwt.decode(token, pem, algorithms=["ES256"], audience=audience)


# Global verifier instance (lazy initialization)
_verifier = None


def _get_verifier() -> SupabaseJWTVerifier:
    global _verifier
    if _verifier is None:
        settings = get_settings()
        _verifier = SupabaseJWTVerifier(settings.supabase_url)
    return _verifier


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> CurrentUser:
    settings = get_settings()

    # Allow demo/local development with a simple demo bearer or no token
    if settings.app_env == "development":
        if credentials is None or credentials.credentials == "demo":
            return CurrentUser(id="demo-user", email="demo@bodify.app", full_name="Demo User", is_demo=True)

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        # Production: verify ES256 token via Supabase JWKS
        verifier = _get_verifier()
        payload = verifier.verify(token, audience="authenticated")
        user_id = payload.get("sub")
        email = payload.get("email")
        user_metadata = payload.get("user_metadata") or {}
        full_name = user_metadata.get("full_name")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no subject",
            )
        return CurrentUser(id=user_id, email=email, full_name=full_name, is_demo=False)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )
    except Exception as e:
        # Catch JWKS fetch errors or other unexpected issues
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
        )
