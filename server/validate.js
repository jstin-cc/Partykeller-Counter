export function validName(name) {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 24;
}

export function validPin(pin) {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}
