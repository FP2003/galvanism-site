import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything is behind auth except the sign-in flow and the public sample-data
// preview. Accounts are created by the admin (info/roadmap.md Phase 1) — there is
// no public sign-up route.
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/preview(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
