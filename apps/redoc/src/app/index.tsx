/** `/` — Spec load screen + post-load docs viewer. Thin route. */
import { createFileRoute } from "@tanstack/react-router";

import { ComposeLoadedDocs } from "@/app/map-loaded-docs";
import {
  validateSpecLoadSearch,
  type SpecLoadSearch,
} from "@/domains/openapi/api/spec-source-search";
import { mergeOperationSearch } from "@/domains/openapi/api/write-operation-search";
import { SpecLoadScreen } from "@/domains/openapi/screens/spec-load-screen";

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>) => validateSpecLoadSearch(raw),
  component: SpecLoadRoute,
});

/** Route shell — maps validated search into SpecLoadScreen / ComposeLoadedDocs. */
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
      renderLoaded={({ success, reset }) => (
        <ComposeLoadedDocs
          success={success}
          search={search}
          onOperationChange={(op, options) => {
            void navigate({
              search: (previous: SpecLoadSearch) => mergeOperationSearch(previous, op),
              replace: options.replace,
            });
          }}
          onReset={() => {
            void navigate({
              search: (previous: SpecLoadSearch) => mergeOperationSearch(previous, undefined),
              replace: true,
            });
            reset();
          }}
        />
      )}
    />
  );
}
