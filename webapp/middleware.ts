import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isAuthorizedBasicAuth } from './lib/basicAuth';

export function middleware(request: NextRequest) {
  const username = process.env.BASIC_AUTH_USERNAME;
  const password = process.env.BASIC_AUTH_PASSWORD;

  // Leave local/dev environments unblocked until credentials are configured.
  if (!username || !password) {
    return NextResponse.next();
  }

  const authorization = request.headers.get('authorization');

  if (isAuthorizedBasicAuth(authorization, username, password)) {
    return NextResponse.next();
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="toshl-integration", charset="UTF-8"'
    }
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
