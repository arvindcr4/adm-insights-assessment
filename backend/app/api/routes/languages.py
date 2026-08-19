from typing import Annotated

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas import LanguageOut, LanguagesResponse

router = APIRouter(prefix="/languages", tags=["languages"])

SettingsDep = Annotated[Settings, Depends(get_settings)]


@router.get("", response_model=LanguagesResponse, summary="Supported target languages")
def list_languages(settings: SettingsDep) -> LanguagesResponse:
    return LanguagesResponse(
        languages=[
            LanguageOut(code=code, label=label)
            for code, label in sorted(settings.supported_languages.items())
        ]
    )
