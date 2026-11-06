import { auth, currentUser, type User } from "@clerk/nextjs/server";

// auth() lê a sessão localmente; currentUser() consulta a API do Clerk e fica restrito ao carregamento inicial.
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

export async function getUserProfile() {
  const user = await currentUser();
  return user ? profileOf(user) : null;
}

// Nome e e-mail de um usuário do Clerk (também usado nos e-mails, que leem o usuário pelo id).
export function profileOf(user: User) {
  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || email.split("@")[0] || "Você";
  return { userId: user.id, email, name };
}
