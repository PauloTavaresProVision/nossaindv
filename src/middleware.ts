import createIntlMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

export default function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  // Convert absolute Location headers (built from request.url, que dentro
  // de Docker contém a porta interna 3000) em paths relativos. Assim o
  // browser usa o mesmo scheme/host/porta que veio no pedido original
  // — útil quando estamos atrás de um reverse proxy (nginx, traefik…).
  if (response.status === 307 || response.status === 308) {
    const location = response.headers.get("location");
    if (location) {
      try {
        const url = new URL(location);
        response.headers.set(
          "location",
          url.pathname + url.search + url.hash
        );
      } catch {
        // already relative — nada a fazer
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
