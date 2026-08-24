import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Next 16's `proxy` convention (formerly `middleware`).
 *
 * Navigation-level protection only — it stops unauthenticated users landing on
 * a portal URL and removes the logged-out flash. It is NOT the security
 * boundary: layouts and server actions re-check against the database.
 */
export default auth((req) => {
  const { nextUrl } = req;
  const token = req.auth;
  const path = nextUrl.pathname;

  const isAdminArea = path.startsWith("/admin");
  const isClientArea = path.startsWith("/dashboard");

  if (!isAdminArea && !isClientArea) return NextResponse.next();

  if (!token?.user) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  const role = token.user.role;
  if (isAdminArea && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }
  if (isClientArea && role !== "CLIENT") {
    return NextResponse.redirect(new URL("/admin", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
