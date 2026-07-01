export function generateSku(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .map(w => w.slice(0, 3))
    .join('-')
    .slice(0, 12)
    + '-' + Date.now().toString().slice(-4);
}
