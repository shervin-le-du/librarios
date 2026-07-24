import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$slug/app/team")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$slug/app/settings",
      params: { slug: params.slug },
      hash: "library-team",
      replace: true,
    });
  },
});
