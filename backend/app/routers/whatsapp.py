from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import WhatsAppLog
from ..schemas import WhatsAppResponseOut, WhatsAppSendTextIn, WhatsAppStatusOut
from ..security import get_current_user
from ..whatsapp_client import get_bridge_status, send_text_message


router = APIRouter()


@router.get("/status", response_model=WhatsAppStatusOut)
def status(_: object = Depends(get_current_user)) -> WhatsAppStatusOut:
    payload = get_bridge_status()
    return WhatsAppStatusOut(
        connected=bool(payload.get("connected", False)),
        registered=bool(payload.get("registered", False)),
        lastQr=payload.get("lastQr"),
        detail=payload.get("detail"),
    )


@router.post("/send-text", response_model=WhatsAppResponseOut)
def send_text(
    payload: WhatsAppSendTextIn,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
) -> WhatsAppResponseOut:
    result = send_text_message(payload.phone, payload.text)
    db.add(
        WhatsAppLog(
            phone=payload.phone,
            message=payload.text,
            status="sent" if result.ok else "failed",
            provider_message_id=result.provider_message_id,
        )
    )
    db.commit()
    return WhatsAppResponseOut(ok=result.ok, detail=result.detail, providerMessageId=result.provider_message_id)
