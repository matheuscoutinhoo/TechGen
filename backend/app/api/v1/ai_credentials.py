"""Router de credenciais de IA do usuário (BYOK).

Permite ao usuário trazer, atualizar e remover a própria API key de IA. A chave
entra apenas via ``PUT`` e nunca retorna em texto puro — o ``GET`` devolve só
metadados e uma versão mascarada.
"""
from fastapi import APIRouter, Depends, Response, status

from app.api.deps import get_ai_credential_service, get_current_user
from app.models.user import User
from app.schemas.ai_credential import AICredentialStatus, AICredentialUpsert
from app.services.ai_credential_service import AICredentialService

router = APIRouter(prefix="/ai-credentials", tags=["ai-credentials"])


@router.get(
    "",
    response_model=AICredentialStatus,
    summary="Estado da credencial de IA do usuário",
)
def get_ai_credential(
    current_user: User = Depends(get_current_user),
    service: AICredentialService = Depends(get_ai_credential_service),
) -> AICredentialStatus:
    return service.get_status(current_user)


@router.put(
    "",
    response_model=AICredentialStatus,
    summary="Define ou atualiza a credencial de IA (BYOK)",
)
def upsert_ai_credential(
    payload: AICredentialUpsert,
    current_user: User = Depends(get_current_user),
    service: AICredentialService = Depends(get_ai_credential_service),
) -> AICredentialStatus:
    return service.upsert(current_user, payload)


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a credencial de IA do usuário",
)
def delete_ai_credential(
    current_user: User = Depends(get_current_user),
    service: AICredentialService = Depends(get_ai_credential_service),
) -> Response:
    service.delete(current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
