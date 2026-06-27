export function formatMoneyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  return Number(digits).toLocaleString('ko-KR');
}

export function parseMoneyInput(value: string): number {
  const digits = value.replace(/\D/g, '');

  return digits ? Number(digits) : 0;
}
