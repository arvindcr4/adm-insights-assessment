from fastapi import Request

from app.services.prompt_service import PromptService


def get_prompt_service(request: Request) -> PromptService:
    return request.app.state.prompt_service
