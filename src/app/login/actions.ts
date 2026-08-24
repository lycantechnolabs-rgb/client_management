"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  try {
    // Auth.js resolves the landing page per role in the redirect callback;
    // `next` only applies when the middleware bounced them from a portal URL.
    await signIn("credentials", {
      email,
      password,
      redirectTo: next && next.startsWith("/") ? next : "/portal-entry",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Those details don't match an account." };
    }
    // signIn throws a redirect on success — let it through.
    throw error;
  }
}
