import { useEffect, useMemo, useRef, useState } from "react";
import {
  isNavigableSearchResult,
  searchUnifiedIndex,
  SEARCH_RESULT_TYPES,
  type SearchResult,
  type SearchResultType,
} from "./index";
import { shouldOpenCommandPalette } from "./paletteLogic";

export function CommandPalette({ navigate }: { navigate: (route: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SearchResultType | "all">("all");
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchUnifiedIndex(query, { type }), [query, type]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (shouldOpenCommandPalette(event)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  function choose(result: SearchResult): void {
    setSelected(result);
    if (isNavigableSearchResult(result)) {
      setOpen(false);
      navigate(result.path);
    }
  }

  return (
    <div className="command-palette-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="command-palette" role="dialog" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="dashboard-kicker">Command Palette</p>
            <h2>Search local runtime registry</h2>
          </div>
          <button onClick={() => setOpen(false)}>Close</button>
        </header>
        <div className="palette-controls">
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search routes, docs, blockers..." />
          <select value={type} onChange={(event) => setType(event.target.value as SearchResultType | "all")}>
            {SEARCH_RESULT_TYPES.map((resultType) => (
              <option key={resultType} value={resultType}>
                {resultType}
              </option>
            ))}
          </select>
        </div>
        <div className="palette-results">
          {results.length === 0 ? <p className="empty-search">No local results found.</p> : null}
          {results.slice(0, 10).map((result) => (
            <button className="palette-result" key={result.id} onClick={() => choose(result)}>
              <span>
                <strong>{result.title}</strong>
                <small>{result.description}</small>
              </span>
              <em className={result.status === "BLOCKED" ? "blocked" : ""}>{result.status}</em>
            </button>
          ))}
        </div>
        {selected && !isNavigableSearchResult(selected) ? (
          <footer className="palette-selection">
            Selected {selected.title}. Navigation is {selected.status === "BLOCKED" ? "BLOCKED" : "not a route"}.
          </footer>
        ) : null}
      </section>
    </div>
  );
}
