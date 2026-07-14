export function formatPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '')
  if (/^0\d{9}$/.test(digits)) return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3')
  return (raw || '').trim()
}
