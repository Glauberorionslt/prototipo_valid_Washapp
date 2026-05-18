from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import logging
from time import monotonic

import requests

from app.config import settings


ALLOWLIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
OLD_PLATE_PATTERN = (True, True, True, False, False, False, False)
MERCOSUL_PLATE_PATTERN = (True, True, True, False, True, False, False)
LETTER_FROM_DIGIT = {
    "0": "O",
    "1": "I",
    "2": "Z",
    "4": "A",
    "5": "S",
    "6": "G",
    "7": "Z",
    "8": "B",
}
DIGIT_FROM_LETTER = {
    "A": "4",
    "B": "8",
    "D": "0",
    "G": "6",
    "I": "1",
    "L": "1",
    "O": "0",
    "Q": "0",
    "S": "5",
    "Z": "2",
}

logger = logging.getLogger(__name__)


class PlateReaderUnavailableError(RuntimeError):
    pass


class PlateReaderNotFoundError(RuntimeError):
    pass


class PlateRecognizerRemoteError(RuntimeError):
    pass


class PlateRecognizerNoResultError(RuntimeError):
    pass


@dataclass(frozen=True)
class PlateReaderResult:
    plate: str
    confidence: float | None = None
    raw_text: str | None = None


@dataclass(frozen=True)
class _PlateCandidate:
    plate: str
    score: float
    confidence: float | None
    raw_text: str | None = None


HIGH_CONFIDENCE_SCORE = 128.0


def _iter_region_values() -> list[str]:
    if not settings.plate_recognizer_region:
        return []
    return [item.strip() for item in settings.plate_recognizer_region.split(",") if item.strip()]


def _best_candidate_from_api_result(result: dict) -> PlateReaderResult | None:
    top_plate = _normalize_token(str(result.get("plate") or ""))
    top_confidence = result.get("score")
    top_confidence = float(top_confidence) if top_confidence is not None else None

    ranked_tokens: list[tuple[str, float | None]] = []
    if top_plate:
        ranked_tokens.append((top_plate, top_confidence))

    for candidate in result.get("candidates") or []:
        if not isinstance(candidate, dict):
            continue
        token = _normalize_token(str(candidate.get("plate") or ""))
        confidence = candidate.get("score")
        ranked_tokens.append((token, float(confidence) if confidence is not None else None))

    best_valid: _PlateCandidate | None = None
    best_raw: tuple[str, float | None] | None = None
    for token, confidence in ranked_tokens:
        if not token:
            continue
        if best_raw is None or (len(token), confidence or 0.0) > (len(best_raw[0]), best_raw[1] or 0.0):
            best_raw = (token, confidence)
        candidate = _score_plate(token, confidence)
        if candidate and (best_valid is None or candidate.score > best_valid.score):
            best_valid = candidate

    if best_valid is not None:
        return PlateReaderResult(
            plate=best_valid.plate,
            confidence=best_valid.confidence,
            raw_text=best_valid.raw_text,
        )

    if best_raw is not None:
        return PlateReaderResult(
            plate=best_raw[0],
            confidence=best_raw[1],
            raw_text=best_raw[0],
        )

    return None


def _read_with_plate_recognizer(file_bytes: bytes) -> PlateReaderResult | None:
    if not settings.plate_recognizer_token:
        return None

    files = {
        "upload": ("plate.jpg", file_bytes, "application/octet-stream"),
    }
    data: list[tuple[str, str]] = []
    for region in _iter_region_values():
        data.append(("regions", region))

    try:
        response = requests.post(
            settings.plate_recognizer_api_url,
            headers={"Authorization": f"Token {settings.plate_recognizer_token}"},
            files=files,
            data=data,
            timeout=settings.plate_recognizer_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.HTTPError as exc:
        detail = None
        response = exc.response
        if response is not None:
            try:
                payload = response.json()
            except ValueError:
                payload = None
            if isinstance(payload, dict):
                detail = payload.get("detail") or payload.get("error")
            if detail is None:
                body_text = response.text.strip()
                if body_text:
                    detail = body_text[:240]
            status_code = response.status_code
        else:
            status_code = "sem resposta"
        message = f"Plate Recognizer indisponivel no momento (status {status_code})"
        if detail:
            message = f"{message}: {detail}"
        logger.warning("Plate Recognizer request failed: %s", message)
        raise PlateRecognizerRemoteError(message) from exc
    except requests.RequestException as exc:
        message = f"Plate Recognizer indisponivel no momento: {exc}"
        logger.warning("Plate Recognizer request failed: %s", message)
        raise PlateRecognizerRemoteError(message) from exc
    except ValueError as exc:
        message = f"Plate Recognizer retornou uma resposta invalida: {exc}"
        logger.warning(message)
        raise PlateRecognizerRemoteError(message) from exc

    results = payload.get("results")
    if not isinstance(results, list) or not results:
        logger.info("Plate Recognizer returned no results")
        raise PlateRecognizerNoResultError("Nenhuma placa foi identificada pelo Plate Recognizer na imagem enviada.")

    best_result: PlateReaderResult | None = None
    for result in results:
        if not isinstance(result, dict):
            continue
        candidate = _best_candidate_from_api_result(result)
        if candidate is None:
            continue
        if best_result is None or (candidate.confidence or 0.0) > (best_result.confidence or 0.0):
            best_result = candidate

    if best_result is not None:
        logger.info(
            "Plate scan resolved via Plate Recognizer API: %s (confidence=%s)",
            best_result.plate,
            f"{best_result.confidence:.2f}" if best_result.confidence is not None else "n/a",
        )
        return best_result

    logger.info("Plate Recognizer returned results without a usable plate candidate")
    raise PlateRecognizerNoResultError("Nenhuma placa utilizavel foi identificada pelo Plate Recognizer na imagem enviada.")


def _local_runtime_available() -> bool:
    try:
        _load_runtime()
    except PlateReaderUnavailableError:
        return False
    return True


def _load_runtime():
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
        import easyocr  # type: ignore
    except ImportError as exc:
        raise PlateReaderUnavailableError(
            "Leitor de placa indisponivel. Instale easyocr e opencv-python-headless no backend.",
        ) from exc
    return cv2, np, easyocr


@lru_cache(maxsize=1)
def _get_ocr():
    _, _, easyocr = _load_runtime()
    return easyocr.Reader(["en"], gpu=False, verbose=True)


def _normalize_token(value: str) -> str:
    return "".join(char for char in value.upper() if char.isalnum())


def _expand_token_windows(token: str) -> list[str]:
    normalized = _normalize_token(token)
    if len(normalized) < 6:
        return []
    if len(normalized) <= 7:
        return [normalized]
    return [normalized[index:index + 7] for index in range(0, len(normalized) - 6)]


def _coerce_pattern(token: str, pattern: tuple[bool, ...]) -> tuple[str, int] | None:
    if len(token) != len(pattern):
        return None

    coerced: list[str] = []
    replacements = 0
    for char, wants_letter in zip(token, pattern):
        if wants_letter:
            if char.isalpha():
                coerced.append(char)
                continue
            mapped = LETTER_FROM_DIGIT.get(char)
            if not mapped:
                return None
            coerced.append(mapped)
            replacements += 1
            continue

        if char.isdigit():
            coerced.append(char)
            continue
        mapped = DIGIT_FROM_LETTER.get(char)
        if not mapped:
            return None
        coerced.append(mapped)
        replacements += 1

    return "".join(coerced), replacements


def _score_plate(token: str, confidence: float | None, score_bonus: float = 0.0) -> _PlateCandidate | None:
    normalized = _normalize_token(token)
    if len(normalized) != 7:
        return None

    best: _PlateCandidate | None = None
    for pattern, pattern_boost in ((OLD_PLATE_PATTERN, 34), (MERCOSUL_PLATE_PATTERN, 38)):
        coerced = _coerce_pattern(normalized, pattern)
        if not coerced:
            continue
        value, replacements = coerced
        score = pattern_boost + (confidence or 0) * 100 - replacements * 10 + score_bonus
        if replacements == 0:
            score += 20
        candidate = _PlateCandidate(plate=value, score=score, confidence=confidence, raw_text=token)
        if best is None or candidate.score > best.score:
            best = candidate

    return best


def _decode_image(file_bytes: bytes):
    cv2, np, _ = _load_runtime()
    array = np.frombuffer(file_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise PlateReaderNotFoundError("Nao foi possivel abrir a imagem enviada para leitura da placa.")
    return image


def _resize_percent(image, scale_percent: int):
    cv2, _, _ = _load_runtime()
    width = max(1, int(image.shape[1] * scale_percent / 100))
    height = max(1, int(image.shape[0] * scale_percent / 100))
    return cv2.resize(image, (width, height), interpolation=cv2.INTER_CUBIC)


def _crop_region(image, x: int, y: int, width: int, height: int):
    max_height, max_width = image.shape[:2]
    start_x = max(0, x)
    start_y = max(0, y)
    end_x = min(max_width, x + width)
    end_y = min(max_height, y + height)
    if start_x >= end_x or start_y >= end_y:
        return None
    return image[start_y:end_y, start_x:end_x]


def _build_candidate_crops(image) -> list:
    cv2, _, _ = _load_runtime()
    height, width = image.shape[:2]
    crops: list = []
    fallback_boxes: list[tuple[int, int, int, int]] = []
    seen: set[tuple[int, int, int, int]] = set()

    def add_box(x: int, y: int, box_width: int, box_height: int):
        key = (max(0, x // 10), max(0, y // 10), max(1, box_width // 10), max(1, box_height // 10))
        if key in seen:
            return
        crop = _crop_region(image, x, y, box_width, box_height)
        if crop is None or crop.size == 0:
            return
        seen.add(key)
        crops.append(crop)

    fallback_boxes.extend(
        [
            (int(width * 0.08), int(height * 0.24), int(width * 0.84), int(height * 0.46)),
            (int(width * 0.14), int(height * 0.34), int(width * 0.72), int(height * 0.28)),
            (int(width * 0.2), int(height * 0.4), int(width * 0.6), int(height * 0.2)),
        ]
    )

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Try a plate-focused localization pass before generic contour scanning.
    rect_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (17, 5))
    square_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, rect_kernel)
    gradient = cv2.Sobel(blackhat, ddepth=cv2.CV_32F, dx=1, dy=0, ksize=-1)
    gradient = cv2.convertScaleAbs(gradient)
    gradient = cv2.GaussianBlur(gradient, (5, 5), 0)
    gradient = cv2.morphologyEx(gradient, cv2.MORPH_CLOSE, rect_kernel)
    _, thresholded = cv2.threshold(gradient, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    thresholded = cv2.erode(thresholded, square_kernel, iterations=1)
    thresholded = cv2.dilate(thresholded, square_kernel, iterations=2)
    thresholded = cv2.morphologyEx(thresholded, cv2.MORPH_CLOSE, rect_kernel)

    morphology_result = cv2.findContours(thresholded, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    morphology_contours = morphology_result[0] if len(morphology_result) == 2 else morphology_result[1]
    for contour in sorted(morphology_contours, key=cv2.contourArea, reverse=True)[:10]:
        x, y, box_width, box_height = cv2.boundingRect(contour)
        if box_width < 90 or box_height < 24:
            continue
        ratio = box_width / float(box_height)
        area_ratio = (box_width * box_height) / float(width * height)
        if ratio < 2.2 or ratio > 7.2:
            continue
        if area_ratio < 0.008 or area_ratio > 0.28:
            continue
        padding_x = int(box_width * 0.12)
        padding_y = int(box_height * 0.45)
        add_box(x - padding_x, y - padding_y, box_width + padding_x * 2, box_height + padding_y * 2)
        if len(crops) >= 3:
            return crops[:3]

    filtered = cv2.bilateralFilter(gray, 11, 17, 17)
    edged = cv2.Canny(filtered, 30, 200)
    edged = cv2.dilate(edged, None, iterations=1)
    contour_result = cv2.findContours(edged, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = contour_result[0] if len(contour_result) == 2 else contour_result[1]

    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:12]:
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        x, y, box_width, box_height = cv2.boundingRect(approx)
        if box_width < 60 or box_height < 20:
            continue
        ratio = box_width / float(box_height)
        area_ratio = (box_width * box_height) / float(width * height)
        if ratio < 2.0 or ratio > 6.8:
            continue
        if area_ratio < 0.01 or area_ratio > 0.45:
            continue
        padding_x = int(box_width * 0.08)
        padding_y = int(box_height * 0.3)
        add_box(x - padding_x, y - padding_y, box_width + padding_x * 2, box_height + padding_y * 2)
        if len(crops) >= 3:
            break

    if len(crops) < 3:
        for x, y, box_width, box_height in fallback_boxes:
            add_box(x, y, box_width, box_height)
            if len(crops) >= 3:
                break

    return crops[:3]


def _ensure_bgr(image):
    cv2, _, _ = _load_runtime()
    if len(image.shape) == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    return image


def _build_variants(crop) -> list:
    cv2, _, _ = _load_runtime()
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    _, otsu = cv2.threshold(clahe, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    inverted_otsu = cv2.bitwise_not(otsu)

    return [
        _ensure_bgr(_resize_percent(crop, 150)),
        _ensure_bgr(_resize_percent(otsu, 150)),
        _ensure_bgr(_resize_percent(inverted_otsu, 220)),
    ]


def _build_global_variants(image) -> list:
    cv2, _, _ = _load_runtime()
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    _, otsu = cv2.threshold(clahe, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return [
        _ensure_bgr(_resize_percent(clahe, 100)),
        _ensure_bgr(_resize_percent(otsu, 140)),
    ]


def _run_predict_with_timeout(ocr, image, timeout_seconds: float):
    started_at = monotonic()
    payload = ocr.readtext(
        image,
        detail=1,
        paragraph=False,
        allowlist=ALLOWLIST,
    )
    elapsed = monotonic() - started_at
    if elapsed > timeout_seconds:
        logger.warning("Plate OCR exceeded %.1fs for one variant (%.2fs)", timeout_seconds, elapsed)
    return payload


def _iter_prediction_tokens(predictions) -> list[tuple[str, float | None]]:
    tokens: list[tuple[str, float | None]] = []
    if not predictions:
        return tokens

    for prediction in predictions:
        if not isinstance(prediction, (list, tuple)) or len(prediction) < 3:
            continue
        text = str(prediction[1]).strip()
        confidence = prediction[2]
        if text:
            tokens.append((text, float(confidence) if confidence is not None else None))

    return tokens


def _log_prediction_tokens(stage: str, variant_index: int, tokens: list[tuple[str, float | None]]) -> None:
    if not tokens:
        logger.info("Plate OCR [%s #%s] raw texts: <none>", stage, variant_index)
        return

    preview = ", ".join(
        f"{text.strip() or '<empty>'} ({confidence:.2f})" if confidence is not None else (text.strip() or "<empty>")
        for text, confidence in tokens[:5]
    )
    logger.info("Plate OCR [%s #%s] raw texts: %s", stage, variant_index, preview)


def _extract_candidates_from_prediction(
    predictions,
    results: list[_PlateCandidate],
    raw_hits: list[tuple[str, float | None]],
    stage: str,
    variant_index: int,
    score_bonus: float = 0.0,
) -> bool:
    tokens = _iter_prediction_tokens(predictions)
    raw_hits.extend(tokens)
    _log_prediction_tokens(stage, variant_index, tokens)
    for text, confidence in tokens:
        for token in _expand_token_windows(text):
            candidate = _score_plate(token, confidence, score_bonus=score_bonus)
            if candidate:
                results.append(candidate)
                logger.info(
                    "Plate OCR [%s #%s] candidate: raw=%s normalized=%s score=%.2f confidence=%s",
                    stage,
                    variant_index,
                    text,
                    candidate.plate,
                    candidate.score,
                    f"{candidate.confidence:.2f}" if candidate.confidence is not None else "n/a",
                )
                candidate = _PlateCandidate(
                    plate=candidate.plate,
                    score=candidate.score,
                    confidence=candidate.confidence,
                    raw_text=text,
                )
                results[-1] = candidate
                if candidate.score >= HIGH_CONFIDENCE_SCORE:
                    return True
    return False


def _read_candidates(image, started_at: float, deadline_seconds: float) -> tuple[list[_PlateCandidate], list[tuple[str, float | None]]]:
    ocr = _get_ocr()
    results: list[_PlateCandidate] = []
    raw_hits: list[tuple[str, float | None]] = []

    candidate_crops = [(crop, 0.0) for crop in _build_candidate_crops(image)]

    for crop_index, (crop, score_bonus) in enumerate(candidate_crops, start=1):
        for variant_index, variant in enumerate(_build_variants(crop), start=1):
            if monotonic() - started_at >= deadline_seconds:
                return results, raw_hits
            prediction = _run_predict_with_timeout(ocr, variant, settings.plate_ocr_timeout_seconds)
            if prediction is None:
                logger.info("Plate OCR [crop %s variant %s] produced no result before timeout", crop_index, variant_index)
                continue
            if _extract_candidates_from_prediction(
                prediction,
                results,
                raw_hits,
                stage=f"crop {crop_index}",
                variant_index=variant_index,
                score_bonus=score_bonus,
            ):
                return results, raw_hits
        if results:
            return results, raw_hits

    for variant_index, variant in enumerate(_build_global_variants(image), start=1):
        if monotonic() - started_at >= deadline_seconds:
            return results, raw_hits
        prediction = _run_predict_with_timeout(ocr, variant, settings.plate_ocr_timeout_seconds)
        if prediction is None:
            logger.info("Plate OCR [global #%s] produced no result before timeout", variant_index)
            continue
        if _extract_candidates_from_prediction(prediction, results, raw_hits, stage="global", variant_index=variant_index):
            return results, raw_hits

    if results:
        best = max(results, key=lambda candidate: candidate.score)
        logger.info("Plate OCR best candidate before final return: %s (score=%.2f)", best.plate, best.score)
    return results, raw_hits


def scan_plate_image(file_bytes: bytes) -> PlateReaderResult:
    if not file_bytes:
        raise PlateReaderNotFoundError("Envie uma imagem para leitura da placa")

    logger.info("Plate scan started with %s bytes", len(file_bytes))
    remote_error: PlateRecognizerRemoteError | None = None
    remote_no_result: PlateRecognizerNoResultError | None = None
    try:
        api_result = _read_with_plate_recognizer(file_bytes)
    except PlateRecognizerRemoteError as exc:
        remote_error = exc
        api_result = None
    except PlateRecognizerNoResultError as exc:
        remote_no_result = exc
        api_result = None
    if api_result is not None:
        return api_result

    if not settings.plate_recognizer_token and not _local_runtime_available():
        raise PlateReaderUnavailableError(
            "Leitor de placa indisponivel. Configure PLATE_RECOGNIZER_TOKEN no backend ou instale easyocr e opencv-python-headless no backend.",
        )

    if settings.plate_recognizer_token and remote_error is not None and not _local_runtime_available():
        raise PlateReaderUnavailableError(str(remote_error)) from remote_error
    if settings.plate_recognizer_token and remote_no_result is not None and not _local_runtime_available():
        raise PlateReaderNotFoundError(str(remote_no_result)) from remote_no_result

    image = _decode_image(file_bytes)
    _get_ocr()
    started_at = monotonic()
    candidates, raw_hits = _read_candidates(image, started_at, float(settings.plate_scan_timeout_seconds))
    if not candidates:
        logger.info("Plate scan finished without candidates in %.2fs", monotonic() - started_at)
        best_raw = None
        best_confidence = None
        if raw_hits:
            best_raw, best_confidence = max(
                raw_hits,
                key=lambda item: (len(_normalize_token(item[0])), item[1] or 0.0),
            )
        normalized_raw = _normalize_token(best_raw) if best_raw else None
        if normalized_raw:
            logger.info(
                "Plate scan returning raw sequence without BR validation: %s (confidence=%s)",
                normalized_raw,
                f"{best_confidence:.2f}" if best_confidence is not None else "n/a",
            )
            return PlateReaderResult(
                plate=normalized_raw,
                confidence=best_confidence,
                raw_text=best_raw,
            )
        raise PlateReaderNotFoundError(
            "Nao foi possivel identificar uma sequencia de caracteres. Tente aproximar mais a camera e reduzir o fundo do veiculo.",
        )

    best = max(candidates, key=lambda candidate: candidate.score)
    logger.info("Plate scan finished in %.2fs with candidate %s", monotonic() - started_at, best.plate)
    return PlateReaderResult(plate=best.plate, confidence=best.confidence, raw_text=best.raw_text)