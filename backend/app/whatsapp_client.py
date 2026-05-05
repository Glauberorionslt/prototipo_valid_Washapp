from __future__ import annotations

from dataclasses import dataclass


@dataclass
class WhatsAppResult:
    ok: bool
    detail: str
    provider_message_id: str | None = None


def _normalize_whatsapp_phone(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits.startswith("55") and len(digits) in {12, 13}:
        return digits
    if len(digits) in {10, 11}:
        return f"55{digits}"
    return digits


def bridge_enabled() -> bool:
    return False


def _bridge_url(path: str) -> str:
    return path


def get_bridge_status() -> dict:
    return {"connected": False, "registered": False, "detail": "WhatsApp desativado neste ambiente"}


def get_bridge_qr() -> dict:
    return {"ok": False, "detail": "WhatsApp desativado neste ambiente", "qr": None}


def reset_bridge_session() -> dict:
    return {"ok": False, "detail": "WhatsApp desativado neste ambiente"}


def send_text_message(phone: str, text: str) -> WhatsAppResult:
    _normalize_whatsapp_phone(phone)
    _ = text
    return WhatsAppResult(ok=False, detail="WhatsApp desativado neste ambiente")
