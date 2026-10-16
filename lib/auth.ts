import { auth, currentUser } from "@clerk/nextjs/server";

// auth() lê a sessão localmente; currentUser() consulta a API do Clerk e fica restrito ao carregamento inicial.
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

export async function getUserProfile() {
  const user = await currentUser();
  if (!user) return null;
  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || email.split("@")[0] || "Você";
  return { userId: user.id, email, name };
}
