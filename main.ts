const TARGET = "https://vibe-diary-server-production.up.railway.app"

function corsHeaders(origin: string | null) {
  const allowedOrigins = new Set([
    "http://localhost:5173",
    "https://realyuyu-vibe-diary.static.hf.space",
  ])

  const allowOrigin =
    origin && allowedOrigins.has(origin)
      ? origin
      : "https://realyuyu-vibe-diary.static.hf.space"

  return new Headers({
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
    "access-control-allow-credentials": "true",
    "access-control-max-age": "86400",
  })
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    })
  }

  const url = new URL(req.url)

  if (url.pathname === "/health") {
    return new Response("ok", {
      status: 200,
      headers: {
        ...Object.fromEntries(corsHeaders(origin)),
        "content-type": "text/plain; charset=utf-8",
      },
    })
  }

  const targetUrl = new URL(url.pathname + url.search, TARGET)

  const headers = new Headers(req.headers)
  headers.delete("host")

  const body =
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : await req.arrayBuffer()

  try {
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
  } catch (error) {
    console.error("Proxy error:", error)

    return new Response(
      JSON.stringify({
        code: 502,
        msg: "Deno proxy failed to reach Railway backend",
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
