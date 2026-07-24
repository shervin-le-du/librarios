import { createFileRoute, redirect } from "@tanstack/react-router";

// Stable URL for staff sign-in. The actual form lives in the staff layout
// (/$slug/app), which renders BrandedSignIn when unauthenticated.
export const Route = createFileRoute("/$slug/login")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$slug/app", params: { slug: params.slug }, replace: true });
  },
});
