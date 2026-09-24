/** `/` — Spec load screen. Thin route: validate search, pass search + navigate. */
import { createFileRoute } from "@tanstack/react-router";

import {
  validateSpecLoadSearch,
  type SpecLoadSearch,
} from "@/domains/openapi/api/spec-source-search";
import { SpecLoadScreen } from "@/domains/openapi/screens/spec-load-screen";

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>) => validateSpecLoadSearch(raw),
  component: SpecLoadRoute,
});

/** Route shell — maps validated search into the openapi SpecLoadScreen. */
function SpecLoadRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <SpecLoadScreen
      search={search}
      onSourceUrlChange={(href) => {
        void navigate({
          search: (previous: SpecLoadSearch) => ({
            ...previous,
            url: href,
          }),
        });
      }}
    />
  );
}
