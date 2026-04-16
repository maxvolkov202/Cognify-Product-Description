import { NextResponse, type NextRequest } from "next/server";

const GUEST_COOKIE = "cognify_guest_id";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function middleware(req: NextRequest) {
  const response = NextResponse.next();

  if (!req.cookies.get(GUEST_COOKIE)) {
    const id = crypto.randomUUID();
    response.cookies.set(GUEST_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: GUEST_COOKIE_MAX_AGE,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo/|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
