export function buildBasicAuthHeader(username: string, password: string) {
  const credentials = `${username}:${password}`;
  const encoded =
    typeof btoa === 'function'
      ? btoa(credentials)
      : Buffer.from(credentials, 'utf8').toString('base64');

  return `Basic ${encoded}`;
}

export function isAuthorizedBasicAuth(
  authorizationHeader: string | null,
  username: string,
  password: string
) {
  if (!authorizationHeader) {
    return false;
  }

  return authorizationHeader === buildBasicAuthHeader(username, password);
}
