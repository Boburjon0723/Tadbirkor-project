/** AUTH_REGISTRATION_ENABLED=true|false; default: dev=true, production=false */
export function isPublicRegistrationEnabled(): boolean {
  const flag = String(process.env.AUTH_REGISTRATION_ENABLED || '').trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') return true;
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  return process.env.NODE_ENV !== 'production';
}
