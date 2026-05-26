import { useMemo, useRef, useState } from "react";
import { isNavigableSearchResult, searchUnifiedIndex, SEARCH_RESULT_TYPES, type SearchResultType } from "./index";

export function SearchPage({ navigate }: { navigate: (route: string) => void }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SearchResultType | "all">("all");
  const [status, setStatus] = useState<string>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchUnifiedIndex(query, { type, status }), [query, type, status]);

  return (
    <section className="search-page" aria-label="Unified search">
      <header className="auth-card">
        <p className="dashboard-kicker">Unified Search</p>
        <h2>Search routes, docs, runtime states, evidence, blockers, and workspace surfaces.</h2>
        <p>No remote index is used. Results come from local product matrix, canonical states, docs registry, and repository surface lists.</p>
      </header>
      <div className="search-controls auth-card">
        <input ref={inputRef} autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try: auth, blocked, runtime, docs..." />
        <select value={type} onChange={(event) => setType(event.target.value as SearchResultType | "all")}>
          {SEARCH_RESULT_TYPES.map((resultType) => (
            <option key={resultType} value={resultType}>
              {resultType}
            </option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          {["all", "PREVIEW_VERIFIED", "STAGED", "BLOCKED", "CONTROLLED_GO"].map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>
      <div className="search-results">
        {results.length === 0 ? (
          <div className="auth-card empty-search">
            <strong>MISSING_DATA</strong>
            <p>No local registry entries matched this query.</p>
          </div>
        ) : null}
        {results.map((result) => (
          <article className={`search-result-card ${result.status === "BLOCKED" ? "blocked" : ""}`} key={result.id}>
            <header>
              <span>{result.type}</span>
              <strong>{result.status}</strong>
            </header>
            <h3>{result.title}</h3>
            <p>{result.description}</p>
            <div className="search-tags">
              {result.tags.map((tag) => (
                <em key={tag}>{tag}</em>
              ))}
            </div>
            <button disabled={!isNavigableSearchResult(result)} onClick={() => navigate(result.path)}>
              {isNavigableSearchResult(result) ? "Open Route" : result.status === "BLOCKED" ? "BLOCKED" : "Select Only"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
