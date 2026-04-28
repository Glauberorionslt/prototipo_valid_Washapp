const STORAGE_KEY = "washapp.selectedOrderId";

export function setSelectedOrderId(orderId: number) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, String(orderId));
}

export function getSelectedOrderId() {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.sessionStorage.getItem(STORAGE_KEY);
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function clearSelectedOrderId() {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(STORAGE_KEY);
}