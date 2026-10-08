from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(..., description="Nombre de usuario o correo")
    password: str = Field(..., min_length=1, description="Contraseña en texto plano")
