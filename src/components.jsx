import React, { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";
import { MessageSquare, User, Copy, RefreshCw, FileText, ChevronRight } from "./icons";

export function Pager({ page, total, onChange, pageSize = 10 }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pager">
      <span>
        {total} records · Page {page} / {pages}
      </span>
      <div className="pager-buttons">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <button disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export function Answer({ item, onFeedback, onRegenerate }) {
  const r = item.response || {};
  const [openSources, setOpenSources] = useState(false);
  const [openDebug, setOpenDebug] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(null);
  const sourceRefs = useRef({});

  useEffect(() => {
    if (openSources && pending) {
      const matchKey = Object.keys(sourceRefs.current).find(
        (k) => k === pending || k === `S${pending}` || `S${k}` === pending
      );
      if (matchKey && sourceRefs.current[matchKey]) {
        const timer = setTimeout(() => {
          sourceRefs.current[matchKey]?.scrollIntoView?.({ behavior: "smooth", block: "center" });
          setPending(null);
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [openSources, pending]);

  const jump = (citation) => {
    setPending(citation);
    setOpenSources(true);
  };

  const handleCopy = () => {
    const textToCopy = r.answer || item.question || "";
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isPending = r.status === "pending";
  const isNoDocs =
    !isPending &&
    (r.code === "NO_DOCUMENTS" ||
    (r.status === "error" && typeof r.answer === "string" && r.answer.toLowerCase().includes("no processed files")));
  const isInsufficient = !isPending && (r.status === "not_found" || r.answerType === "not_found");
  const isError = !isPending && r.status === "error" && !isNoDocs;
  const sourcesCount = r.sources?.length || 0;

  return (
    <article className="exchange">
      {/* User Question Row - Right aligned */}
      <div className="question-row">
        <div className="question">{item.question}</div>
        <div className="user-avatar" title="You">
          <User size={16} />
        </div>
      </div>

      {/* Assistant Answer Row - Left aligned */}
      <div className={"answer " + (isPending ? "pending-answer" : isError ? "error-answer" : isNoDocs ? "nodocs-answer" : isInsufficient ? "insufficient-answer" : "")}>
        <div className="assistant-bubble-row">
          <div className="assistant-avatar" title="AI Assistant">
            <MessageSquare size={16} />
          </div>

          <div className="answer-content-wrap">
            {isPending ? (
              <div className="callout callout-pending">
                <div className="spinner-dots inline-spinner">
                  <span />
                  <span />
                  <span />
                </div>
                <p className="pending-text">Retrieving relevant excerpts and generating grounded answer…</p>
              </div>
            ) : isNoDocs ? (
              <div className="callout callout-warning">
                <div className="callout-body">
                  <strong>No uploaded files</strong>
                  <p>{r.answer || "No processed files are available. Upload a file first."}</p>
                </div>
              </div>
            ) : isInsufficient ? (
              <div className="callout callout-insufficient">
                <div className="callout-body">
                  <p>{r.answer || "I couldn't find enough information in the uploaded files to answer this question."}</p>
                </div>
              </div>
            ) : isError ? (
              <div className="callout callout-error">
                <div className="callout-body">
                  <p>{r.answer || "The AI service encountered an error. Please check uploaded files and try again."}</p>
                  {onRegenerate && (
                    <button
                      type="button"
                      className="retry-btn"
                      onClick={() => onRegenerate(item)}
                    >
                      <RefreshCw size={12} /> Retry
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="markdown-answer-body">
                <Markdown text={r.answer || "No answer was returned."} onCitation={jump} />
              </div>
            )}

            {/* Quick Actions Bar */}
            {!isPending && (
              <div className="answer-actions-bar">
                <button type="button" className="action-btn" onClick={handleCopy} title="Copy response">
                  <Copy size={13} />
                  {copied ? "Copied!" : "Copy"}
                </button>

                {onRegenerate && (
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => onRegenerate(item)}
                    title="Regenerate answer"
                  >
                    <RefreshCw size={13} />
                    Regenerate
                  </button>
                )}

                {sourcesCount > 0 && (
                  <button
                    type="button"
                    className={"action-btn " + (openSources ? "active" : "")}
                    onClick={() => setOpenSources(!openSources)}
                    title="Toggle Sources"
                  >
                    <FileText size={13} />
                    Sources ({sourcesCount}) {openSources ? "∧" : "∨"}
                  </button>
                )}

                {(r.retrieval || r.usage || r.latency_ms || r.timings || r.checks || r.sources?.some((s) => s.relevanceScore != null || s.bm25 != null || s.id)) && (
                  <button
                    type="button"
                    className={"action-btn " + (openDebug ? "active" : "")}
                    onClick={() => setOpenDebug(!openDebug)}
                    title="Toggle Diagnostics"
                  >
                    <span className="mono-icon">&gt;_</span> Diagnostics {openDebug ? "∧" : "∨"}
                  </button>
                )}
              </div>
            )}

            {/* Expandable Sources Details */}
            {sourcesCount > 0 && (
              <details
                className="sources-details"
                open={openSources}
                onToggle={(e) => setOpenSources(e.currentTarget.open)}
              >
                <summary className="sr-only">Sources ({sourcesCount})</summary>
                <div className="sources-details-open">
                  <div className="source-chips" aria-label="Answer sources">
                    {r.sources.map((s) => (
                      <button
                        key={s.id || s.citation}
                        className="chip"
                        type="button"
                        title={s.text}
                        onClick={() => jump(s.citation)}
                      >
                        [{s.citation}] {s.filename || s.name}
                        {s.pageNumber ? ` · p. ${s.pageNumber}` : ""}
                      </button>
                    ))}
                  </div>
                  <div className="sources">
                    {r.sources.map((s) => (
                      <section
                        key={s.id || s.citation}
                        className="source"
                        ref={(element) => {
                          sourceRefs.current[s.citation] = element;
                        }}
                      >
                        <div className="source-meta-row">
                          <strong>
                            [{s.citation}] {s.filename || s.name}
                          </strong>
                          <span className="source-location-tag">
                            {s.pageNumber ? `Page ${s.pageNumber}` : (s.location || "Excerpt")}
                          </span>
                        </div>
                        <p className="source-text">{s.text}</p>
                      </section>
                    ))}
                  </div>
                </div>
              </details>
            )}

            {/* Expandable Debug Details Panel */}
            {(r.retrieval || r.usage || r.latency_ms || r.checks || r.sources?.some((s) => s.relevanceScore != null || s.bm25 != null || s.id)) && (
              <details
                className="debug-details"
                open={openDebug}
                onToggle={(e) => setOpenDebug(e.currentTarget.open)}
              >
                <summary className="sr-only">Diagnostics</summary>
                <div className="debug-details-open">
                  <div className="debug-content">
                    {r.retrieval && (
                      <div className="debug-line">
                        <strong>Hybrid retrieval:</strong> {r.retrieval.hybrid ? "Dense + BM25" : "Standard"} · Reranking: {r.retrieval.reranking} · Candidate count: {r.retrieval.candidate_count ?? "—"}
                        {r.retrieval.page_filter ? ` · Page filter: ${r.retrieval.page_filter}` : ""}
                      </div>
                    )}
                    {r.usage && (
                      <div className="debug-line">
                        <strong>Model diagnostics:</strong> Tokens: {r.usage.total_tokens ?? "not reported"}
                      </div>
                    )}
                    {r.latency_ms != null && (
                      <div className="debug-line">
                        <strong>Latency:</strong> {r.latency_ms} ms
                        {r.timings && (
                          <span> · Retrieval: {r.timings.retrieval_ms} ms · Model: {r.timings.generation_ms} ms</span>
                        )}
                      </div>
                    )}
                    {r.checks && (
                      <div className="debug-line">
                        <strong>Checks:</strong> Citations valid: {String(r.checks.citation_ids_valid)} · Grounded: {String(r.checks.grounded_in_sources)}
                      </div>
                    )}
                    {r.sources?.length > 0 && (
                      <div className="debug-line">
                        <strong>Chunk diagnostics & scores:</strong>
                        <ul className="debug-scores-list">
                          {r.sources.map((s) => (
                            <li key={s.id || s.citation}>
                              [{s.citation}] Chunk ID: {s.id || s.chunkIndex || "—"} | Similarity: {s.relevanceScore ?? s.similarity ?? "—"} | BM25: {s.bm25 ?? "—"} | RRF: {s.rrf ?? "—"}
                              {s.rerankScore != null ? ` | Rerank: ${s.rerankScore.toFixed(3)}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            )}

            {/* Feedback Buttons */}
            {/* {onFeedback && r.status === "answered" && (
              <div className="feedback">
                <button type="button" onClick={() => onFeedback(item.id, "helpful")}>
                  Helpful
                </button>
                <button type="button" onClick={() => onFeedback(item.id, "unhelpful")}>
                  Needs improvement
                </button>
              </div>
            )} */}
          </div>
        </div>
      </div>
    </article>
  );
}
