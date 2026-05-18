from __future__ import annotations

from types import SimpleNamespace

from app.models import Customer
from app import plate_reader
from app.plate_reader import PlateReaderNotFoundError, PlateReaderResult, PlateReaderUnavailableError, PlateRecognizerRemoteError
from app.plate_reader_quota import PLATE_READER_MONTHLY_POOL



def test_plate_reader_returns_existing_customer(client, auth_headers, db_session, monkeypatch):
    customer = Customer(
        company_id=1,
        name="Cliente da Placa",
        phone="11999990000",
        vehicle="Onix",
        plate="ABC1234",
        color="Preto",
        is_default=False,
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    monkeypatch.setattr(
        "app.routers.orders.scan_plate_image",
        lambda *args, **kwargs: PlateReaderResult(plate="ABC1234", confidence=0.98),
    )

    response = client.post(
        "/orders/plate-reader/scan",
        headers=auth_headers,
        files={"upload": ("placa.jpg", b"fake-image", "image/jpeg")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["plate"] == "ABC1234"
    assert payload["customer"]["id"] == customer.id
    assert payload["reservedOrderId"] is None


def test_plate_reader_reserves_order_id_when_customer_is_missing(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        "app.routers.orders.scan_plate_image",
        lambda *args, **kwargs: PlateReaderResult(plate="XYZ9A88", confidence=0.88),
    )

    response = client.post(
        "/orders/plate-reader/scan",
        headers=auth_headers,
        files={"upload": ("placa.jpg", b"fake-image", "image/jpeg")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["plate"] == "XYZ9A88"
    assert payload["customer"] is None
    assert payload["reservedOrderId"] == 1
    assert payload["plateReaderQuotaLimit"] == PLATE_READER_MONTHLY_POOL
    assert payload["plateReaderQuotaUsed"] == 1
    assert payload["plateReaderQuotaRemaining"] == PLATE_READER_MONTHLY_POOL - 1
    assert payload["plateReaderLowQuotaWarning"] is False


def test_plate_reader_returns_raw_sequence_without_valid_br_plate(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        "app.routers.orders.scan_plate_image",
        lambda *args, **kwargs: PlateReaderResult(plate="SSJFIE", confidence=0.35, raw_text="SSJFIE"),
    )

    response = client.post(
        "/orders/plate-reader/scan",
        headers=auth_headers,
        files={"upload": ("placa.jpg", b"fake-image", "image/jpeg")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["plate"] == "SSJFIE"
    assert payload["rawText"] == "SSJFIE"
    assert payload["customer"] is None
    assert payload["reservedOrderId"] == 1


def test_plate_reader_returns_service_unavailable_when_runtime_is_missing(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        "app.routers.orders.scan_plate_image",
        lambda *args, **kwargs: (_ for _ in ()).throw(PlateReaderUnavailableError("runtime ausente")),
    )

    response = client.post(
        "/orders/plate-reader/scan",
        headers=auth_headers,
        files={"upload": ("placa.jpg", b"fake-image", "image/jpeg")},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "runtime ausente"


def test_plate_reader_returns_not_found_when_no_plate_is_detected(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        "app.routers.orders.scan_plate_image",
        lambda *args, **kwargs: (_ for _ in ()).throw(PlateReaderNotFoundError("placa nao encontrada")),
    )

    response = client.post(
        "/orders/plate-reader/scan",
        headers=auth_headers,
        files={"upload": ("placa.jpg", b"fake-image", "image/jpeg")},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "placa nao encontrada"


def test_plate_reader_blocks_when_monthly_quota_is_exhausted(client, auth_headers, monkeypatch):
    monkeypatch.setattr("app.plate_reader_quota.PLATE_READER_MONTHLY_POOL", 2)
    monkeypatch.setattr(
        "app.routers.orders.scan_plate_image",
        lambda *args, **kwargs: PlateReaderResult(plate="XYZ9A88", confidence=0.88),
    )

    first_response = client.post(
        "/orders/plate-reader/scan",
        headers=auth_headers,
        files={"upload": ("placa.jpg", b"fake-image", "image/jpeg")},
    )
    second_response = client.post(
        "/orders/plate-reader/scan",
        headers=auth_headers,
        files={"upload": ("placa.jpg", b"fake-image", "image/jpeg")},
    )
    third_response = client.post(
        "/orders/plate-reader/scan",
        headers=auth_headers,
        files={"upload": ("placa.jpg", b"fake-image", "image/jpeg")},
    )

    assert first_response.status_code == 200
    assert first_response.json()["plateReaderQuotaRemaining"] == 1
    assert first_response.json()["plateReaderLowQuotaWarning"] is True
    assert second_response.status_code == 200
    assert second_response.json()["plateReaderQuotaRemaining"] == 0
    assert second_response.json()["plateReaderLowQuotaWarning"] is True
    assert third_response.status_code == 403
    assert "cota mensal" in third_response.json()["detail"]


def test_scan_plate_image_prefers_vision_api_result(monkeypatch):
    monkeypatch.setattr(
        "app.plate_reader._read_with_plate_recognizer",
        lambda *_args, **_kwargs: PlateReaderResult(plate="ABC1D23", confidence=0.97, raw_text="ABC1D23"),
    )
    monkeypatch.setattr(
        "app.plate_reader._decode_image",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("local OCR should not run when API succeeds")),
    )

    result = plate_reader.scan_plate_image(b"fake-image")

    assert result.plate == "ABC1D23"
    assert result.raw_text == "ABC1D23"


def test_scan_plate_image_falls_back_to_local_ocr_when_api_returns_none(monkeypatch):
    monkeypatch.setattr("app.plate_reader._read_with_plate_recognizer", lambda *_args, **_kwargs: None)
    monkeypatch.setattr("app.plate_reader._decode_image", lambda *_args, **_kwargs: "decoded-image")
    monkeypatch.setattr("app.plate_reader._get_ocr", lambda: object())
    monkeypatch.setattr(
        "app.plate_reader._read_candidates",
        lambda image, *_args, **_kwargs: ([plate_reader._PlateCandidate(plate="ABC1234", score=90, confidence=0.91, raw_text="ABC1234")], []),
    )

    result = plate_reader.scan_plate_image(b"fake-image")

    assert result.plate == "ABC1234"
    assert result.raw_text == "ABC1234"


def test_scan_plate_image_surfaces_remote_error_when_local_ocr_is_unavailable(monkeypatch):
    monkeypatch.setattr(
        "app.plate_reader.settings",
        SimpleNamespace(plate_recognizer_token="configured-token"),
    )
    monkeypatch.setattr(
        "app.plate_reader._read_with_plate_recognizer",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(PlateRecognizerRemoteError("Plate Recognizer indisponivel no momento (status 401): Invalid token")),
    )
    monkeypatch.setattr("app.plate_reader._local_runtime_available", lambda: False)

    try:
        plate_reader.scan_plate_image(b"fake-image")
    except PlateReaderUnavailableError as exc:
        assert "status 401" in str(exc)
        assert "Invalid token" in str(exc)
    else:
        raise AssertionError("expected PlateReaderUnavailableError")


def test_create_order_accepts_reserved_order_id(client, auth_headers):
    response = client.post(
        "/orders",
        headers=auth_headers,
        json={
            "reservedOrderId": 17,
            "customerName": "cliente avulso (17)",
            "phone": "00000000000",
            "vehicle": "veiculo avulso (17)",
            "plate": "ABC1234",
            "color": "cor avulso (17)",
            "washType": "Lavagem Simples",
            "basePrice": 35,
            "total": 35,
            "items": [],
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["id"] == 17
    assert payload["customerName"] == "cliente avulso (17)"