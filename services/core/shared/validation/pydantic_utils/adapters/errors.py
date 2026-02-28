from pydantic import BaseModel, ValidationError
from typing import Any

def serialize_validation_errors(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Преобразует ошибки валидации Pydantic в JSON-сериализуемый вид
    """
    def safe_serialize(obj):
        if isinstance(obj, BaseModel):
            return obj.model_dump(mode="json")
        elif isinstance(obj, dict):
            return {k: safe_serialize(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [safe_serialize(v) for v in obj]
        elif isinstance(obj, Exception):
            return str(obj)
        return obj

    for err in errors:
        if "input" in err:
            err["input"] = safe_serialize(err["input"])
        if "ctx" in err:
            err["ctx"] = safe_serialize(err["ctx"])
    return errors