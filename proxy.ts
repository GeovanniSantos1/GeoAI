import { clerkMiddleware } from "@clerk/nextjs/server";

// Disponibiliza a sessão do Clerk para páginas e APIs. Nenhuma rota é bloqueada aqui: cada API confere o usuário,
// e o webhook do Telegram (/api/telegram) precisa continuar público.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
