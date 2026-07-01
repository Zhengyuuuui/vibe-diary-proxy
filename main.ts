const FRONTEND_TARGET = "https://realyuyu-vibe-diary.static.hf.space"
const API_TARGET = "https://vibe-diary-server-production.up.railway.app"

const PROXY_ORIGIN = "https://vibe-diary-proxy-5njrqkmkz5qc.zysgm123.deno.net"

function corsHeaders(origin: string | null) {
  const allowedOrigins = new Set([
    "http://localhost:5173",
    "https://realyuyu-vibe-diary.static.hf.space",
    PROXY_ORIGIN,
  ])

  const allowOrigin =
    origin && allowedOrigins.has(origin)
      ? origin
      : PROXY_ORIGIN

  return new Headers({
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
    "access-control-allow-credentials": "true",
    "access-control-max-age": "86400",
  })
}

function isApiRequest(pathname: string) {
  return pathname.startsWith("/api/v1")
}

function isFrontendFallback(pathname: string) {
  if (pathname === "/") return true
  if (pathname === "/index.html") return false
  if (pathname.startsWith("/assets/")) return false
  if (pathname.includes(".")) return false

  return true
}

async function proxyRequest(req: Request, target: string, pathnameOverride?: string) {
  const origin = req.headers.get("origin")
  const url = new URL(req.url)

  const targetPath = pathnameOverride ?? url.pathname
  const targetUrl = new URL(targetPath + url.search, target)

  const headers = new Headers(req.headers)
  headers.delete("host")

  const body =
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : await req.arrayBuffer()

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    redirect: "manual",
  })

  const responseHeaders = new Headers(upstream.headers)

  for (const [key, value] of corsHeaders(origin)) {
    responseHeaders.set(key, value)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")
  const url = new URL(req.url)

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    })
  }

  if (url.pathname === "/health") {
    return new Response("ok", {
      status: 200,
      headers: {
        ...Object.fromEntries(corsHeaders(origin)),
        "content-type": "text/plain; charset=utf-8",
      },
    })
  }

  try {
    if (isApiRequest(url.pathname)) {
      return await proxyRequest(req, API_TARGET)
    }

    if (isFrontendFallback(url.pathname)) {
      return await proxyRequest(req, FRONTEND_TARGET, "/index.html")
    }

    return await proxyRequest(req, FRONTEND_TARGET)
  } catch (error) {
    console.error("Proxy error:", error)

    return new Response(
      JSON.stringify({
        code: 502,
        msg: "Deno proxy failed",
      }),
      {
        status: 502,
        headers: {
          ...Object.fromEntries(corsHeaders(origin)),
          "content-type": "application/json; charset=utf-8",
        },
      },
    )
  }
})
