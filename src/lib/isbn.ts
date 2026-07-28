/** ISBN-13 barcodes are EAN-13 codes in the Bookland prefixes 978 / 979. */
const BOOKLAND_PREFIXES = ["978", "979"];

export function isValidIsbn13(raw: string): boolean {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length !== 13) return false;
  if (!BOOKLAND_PREFIXES.some((p) => digits.startsWith(p))) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(digits[12]);
}

/** Groups a 13-digit ISBN as 978-XXXXXXXXX-X for display. */
export function formatIsbn13(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length !== 13) return raw;
  return `${digits.slice(0, 3)}-${digits.slice(3, 12)}-${digits.slice(12)}`;
}
