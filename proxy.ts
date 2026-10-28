import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { canonicalRedirect } from "@/lib/legal";

// Disponibiliza a sessão do Clerk para páginas e APIs. Nenhuma rota é bloqueada aqui: cada API confere o usuário,
// e o webhook do Telegram (/api/telegram) precisa continuar público.
// Antes do Clerk, as páginas abertas no endereço antigo da Vercel vão para o domínio próprio.
const clerk = clerkMiddleware();

export default function proxy(req: NextRequest, ev: NextFetchEvent) {
  const to = canonicalRedirect(req.headers.get("host"), req.nextUrl.pathname, req.nextUrl.search);
  return to ? NextResponse.redirect(to, 308) : clerk(req, ev);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
