from __future__ import annotations

from dataclasses import dataclass

import requests

from .config import settings


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
    return bool(settings.whatsapp_bridge_url)


def _bridge_url(path: str) -> str:
    return f"{settings.whatsapp_bridge_url.rstrip('/')}{path}"


def get_bridge_status() -> dict:
    if not bridge_enabled():
        return {"connected": False, "registered": False, "detail": "Bridge not configured"}
    try:
        response = requests.get(_bridge_url(
            "/session/status"), timeout=settings.whatsapp_timeout_seconds)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        return {"connected": False, "registered": False, "detail": str(exc)}


def get_bridge_qr() -> dict:
    if not bridge_enabled():
        return {"ok": False, "detail": "Bridge not configured", "qr": None}
    try:
        response = requests.get(_bridge_url(
            "/session/qr"), timeout=settings.whatsapp_timeout_seconds)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        return {"ok": False, "detail": str(exc), "qr": None}


def reset_bridge_session() -> dict:
    if not bridge_enabled():
        return {"ok": False, "detail": "Bridge not configured"}
    try:
        response = requests.post(_bridge_url(
            "/session/reset"), timeout=settings.whatsapp_timeout_seconds)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        return {"ok": False, "detail": str(exc)}


def send_text_message(phone: str, text: str) -> WhatsAppResult:
    if not bridge_enabled():
        return WhatsAppResult(ok=False, detail="WhatsApp bridge not configured")
    normalized_phone = _normalize_whatsapp_phone(phone)
    if len(normalized_phone) not in {12, 13}:
        return WhatsAppResult(ok=False, detail="Numero de WhatsApp invalido para envio")
    try:
        response = requests.post(
            _bridge_url("/messages/send-text"),
            json={"phone": normalized_phone, "text": text},
            timeout=settings.whatsapp_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        return WhatsAppResult(
            ok=bool(payload.get("ok", False)),
            detail=str(payload.get("detail", "sent")),
            provider_message_id=payload.get("providerMessageId"),
        )
    except requests.RequestException as exc:
        return WhatsAppResult(ok=False, detail=str(exc))
