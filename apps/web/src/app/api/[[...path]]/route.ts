import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_BACKEND = 'https://tadbirkor-backend-production.up.railway.app';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'host',
]);

function resolveBackendBase(): string {
  const raw =
    process.env.API_PROXY_TARGET ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    DEFAULT_BACKEND;
  return String(raw).trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

async function proxyRequest(req: NextRequest, pathSegments: string[]) {
  const backend = resolveBackendBase();
  const path = pathSegments.filter(Boolean).join('/');
  const targetUrl = `${backend}/api/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const low = key.toLowerCase();
    if (!HOP_BY_HOP.has(low)) {
      headers.set(key, value);
    }
  });

  let body: ArrayBuffer | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.arrayBuffer();
  }

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    cache: 'no-store',
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const low = key.toLowerCase();
    if (!HOP_BY_HOP.has(low)) {
      responseHeaders.append(key, value);
    }
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type RouteCtx = { params: { path?: string[] } };

async function handle(req: NextRequest, ctx: RouteCtx) {
  const segments = ctx.params.path ?? [];
  return proxyRequest(req, segments);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
