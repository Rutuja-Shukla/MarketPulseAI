import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Database, X } from "lucide-react";
import { Badge, SentimentBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/Feedback";
import { api, ApiError } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import type { ChatHistory, ChatMessage } from "@/types";

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${index}`} className="font-medium text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${keyPrefix}-${index}`}>{part}</span>
    ),
  );
}

function MessageBody({ content }: { content: string }) {
  const blocks = content.split("\n");
  return (
    <div className="space-y-2 text-[12.5px] leading-relaxed">
      {blocks.map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-1" />;
        if (line.startsWith("- ")) {
          return (
            <div key={index} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden />
              <span>{renderInline(line.slice(2), `l${index}`)}</span>
            </div>
          );
        }
        return <p key={index}>{renderInline(line, `l${index}`)}</p>;
      })}
    </div>
  );
}

export function AssistantPanel({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<ChatMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const history = useQuery({
    queryKey: ["chat", projectId],
    queryFn: () => api.get<ChatHistory>(`/projects/${projectId}/chat`),
    enabled: open,
  });

  const send = useMutation({
    mutationFn: (content: string) => api.post<ChatMessage>(`/projects/${projectId}/chat`, { content }),
    onMutate: (content) => {
      setError(null);
      setPending({
        id: `pending-${Date.now()}`,
        role: "user",
        content,
        citations: [],
        retrieval_trace: [],
        provider: "user",
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: (message) => {
      setPending(null);
      setInput("");
      void queryClient.invalidateQueries({ queryKey: ["chat", projectId] });
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      void message;
    },
    onError: (err) => {
      setPending(null);
      setError(err instanceof ApiError ? err.detail : "The assistant could not answer");
    },
  });

  const messages = [...(history.data?.messages ?? []), ...(pending ? [pending] : [])];

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [open, messages.length]);

  if (!open) return null;

  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close assistant"
        className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-[460px] flex-col border-l border-line bg-paper shadow-lift">
        <header className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <div className="eyebrow">Research assistant</div>
            <h2 className="mt-1 font-serif text-[19px] leading-tight">Ask the evidence</h2>
            <p className="mt-1 text-[11px] text-muted">
              Retrieves stored records first. Answers cite what they used.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {history.isLoading ? (
            <p className="text-[12px] text-muted">Loading conversation…</p>
          ) : history.isError ? (
            <ErrorState message={(history.error as Error).message} onRetry={() => history.refetch()} />
          ) : messages.length === 0 ? (
            <div>
              <p className="text-[12.5px] leading-relaxed text-muted">
                This assistant only answers from this project's stored evidence. Try one of these:
              </p>
              <div className="mt-3 space-y-1.5">
                {(history.data?.suggestions ?? []).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send.mutate(suggestion)}
                    className="block w-full border border-line px-3 py-2 text-left text-[11.5px] text-muted transition-colors hover:border-muted/40 hover:text-ink"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={cn(message.role === "user" ? "pl-8" : "pr-2")}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="mono text-[9px] uppercase tracking-[0.14em] text-muted">
                    {message.role === "user" ? "You" : "Assistant"}
                  </span>
                  {message.role === "assistant" ? (
                    <Badge tone="outline">{message.provider.replace(/-v1$/, "")}</Badge>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "border px-3.5 py-3",
                    message.role === "user"
                      ? "border-navy/20 bg-navy/[0.04] text-ink"
                      : "border-line bg-canvas text-ink",
                  )}
                >
                  <MessageBody content={message.content} />
                </div>
                {message.citations.length > 0 ? (
                  <details className="mt-2 border border-line bg-subtle/40">
                    <summary className="cursor-pointer px-3 py-2 text-[10.5px] uppercase tracking-[0.1em] text-muted">
                      {message.citations.length} evidence citation{message.citations.length > 1 ? "s" : ""}
                    </summary>
                    <div className="space-y-2 border-t border-line px-3 py-2">
                      {message.citations.map((citation, index) => (
                        <div key={citation.id ?? index} className="text-[11px] leading-relaxed">
                          <div className="flex items-center gap-2">
                            <span className="mono text-[9px] text-muted">{String(index + 1).padStart(2, "0")}</span>
                            <span className="text-ink">{citation.source_name}</span>
                            {citation.sentiment ? <SentimentBadge sentiment={citation.sentiment} /> : null}
                          </div>
                          <p className="mt-1 text-muted">{citation.excerpt}</p>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted">
                            <span>{formatDate(citation.published_at)}</span>
                            {citation.source_url ? (
                              citation.is_demo ? (
                                <span className="mono text-[9px] uppercase tracking-[0.08em] text-warning">
                                  synthetic source
                                </span>
                              ) : (
                                <a href={citation.source_url} target="_blank" rel="noreferrer" className="link-underline">
                                  open source
                                </a>
                              )
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
                {message.retrieval_trace.length > 0 ? (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-[10px] uppercase tracking-[0.1em] text-muted">
                      Retrieval trace
                    </summary>
                    <ul className="mt-1 space-y-1">
                      {message.retrieval_trace.map((step) => (
                        <li key={step.step} className="text-[10.5px] text-muted">
                          <span className="mono uppercase tracking-[0.06em]">{step.step}</span> — {step.detail}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ))
          )}
          {send.isPending ? (
            <div className="flex items-center gap-2 text-[11.5px] text-muted">
              <Database className="h-3.5 w-3.5 animate-pulse" /> Retrieving evidence…
            </div>
          ) : null}
          {error ? <p className="text-[11.5px] text-negative">{error}</p> : null}
        </div>

        <form
          className="border-t border-line p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const value = input.trim();
            if (!value || send.isPending) return;
            send.mutate(value);
          }}
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  const value = input.trim();
                  if (value && !send.isPending) send.mutate(value);
                }
              }}
              rows={2}
              placeholder="Why is pricing perceived as a weakness?"
              aria-label="Ask the assistant"
              className="min-h-[52px] flex-1 resize-none border border-line bg-canvas px-3 py-2 text-[12.5px] focus:border-accent focus:outline-none"
            />
            <Button type="submit" size="sm" className="h-[52px] w-11 px-0" disabled={!input.trim() || send.isPending} aria-label="Send question">
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            Answers are limited to this project's evidence and are not a substitute for internal data.
          </p>
        </form>
      </aside>
    </div>
  );
}
