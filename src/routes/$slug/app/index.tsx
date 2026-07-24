import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$slug/app/")({
  ssr: false,
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$slug/app/dashboard", params: { slug: params.slug } });
  },
});
