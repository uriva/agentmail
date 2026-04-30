import { useState } from "preact/hooks";
import { useInfiniteQuery } from "./db.ts";

export const AccountMessagesList = ({
  accountId,
  accountAddress,
}: {
  accountId: string;
  accountAddress: string;
}) => {
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(
    null,
  );
  
  const { data, isLoading, error, loadNextPage, canLoadNextPage } =
    useInfiniteQuery({
      messages: {
        $: {
          where: { "account.id": accountId },
          limit: 20,
          order: { timestamp: "desc" },
        },
      },
    });

  if (isLoading && !data) {
    return (
      <div class="mt-2 p-4 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-500 text-center text-sm">
        Loading messages...
      </div>
    );
  }

  if (error) {
    return (
      <div class="mt-2 p-4 bg-slate-900/50 border border-slate-700 rounded-lg text-red-400 text-center text-sm">
        Error loading messages.
      </div>
    );
  }

  const messages = data?.messages || [];

  return (
    <div class="mt-2 p-4 bg-slate-900/50 border border-slate-700 rounded-lg space-y-2">
      <div class="text-xs text-slate-400 font-medium uppercase tracking-wider flex justify-between">
        <span>Messages</span>
        {expandedMessageId && (
          <button
            onClick={() => setExpandedMessageId(null)}
            class="text-blue-400 hover:text-blue-300 lowercase"
          >
            collapse all
          </button>
        )}
      </div>
      {messages.length === 0 ? (
        <div class="text-slate-500 text-center py-4">No messages yet.</div>
      ) : (
        <>
          {messages.map((msg: any) => {
            const isExpanded = expandedMessageId === msg.id;
            return (
              <div
                key={msg.id}
                class="bg-slate-900 rounded-lg border border-slate-700"
              >
                <div
                  onClick={() =>
                    setExpandedMessageId(isExpanded ? null : msg.id)
                  }
                  class={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-800/50 transition-colors ${
                    isExpanded ? "border-b border-slate-700" : ""
                  }`}
                >
                  <span
                    class={`text-xs px-2 py-0.5 rounded font-medium ${
                      msg.direction === "inbound"
                        ? "bg-blue-900/50 text-blue-300"
                        : "bg-emerald-900/50 text-emerald-300"
                    }`}
                  >
                    {msg.direction === "inbound" ? "IN" : "OUT"}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm text-white truncate">
                      {msg.subject || "(no subject)"}
                    </div>
                    <div class="text-xs text-slate-400 truncate">
                      {msg.direction === "inbound"
                        ? `From: ${msg.from}`
                        : `To: ${accountAddress}`}
                    </div>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <span
                      class={`text-xs ${
                        msg.status === "sent" || msg.status === "delivered"
                          ? "text-green-400"
                          : msg.status === "failed"
                          ? "text-red-400"
                          : "text-slate-400"
                      }`}
                    >
                      {msg.status}
                    </span>
                    <div class="text-xs text-slate-500 mt-0.5">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div class="p-3 space-y-3 text-sm">
                    <div class="space-y-1 text-slate-300">
                      <div class="flex gap-2">
                        <span class="text-slate-500 w-12 flex-shrink-0">
                          From
                        </span>
                        <span class="text-white">{msg.from}</span>
                      </div>
                      <div class="flex gap-2">
                        <span class="text-slate-500 w-12 flex-shrink-0">To</span>
                        <span class="text-white">
                          {Array.isArray(msg.to)
                            ? msg.to.join(", ")
                            : String(msg.to)}
                        </span>
                      </div>
                      {msg.cc?.length > 0 && (
                        <div class="flex gap-2">
                          <span class="text-slate-500 w-12 flex-shrink-0">
                            CC
                          </span>
                          <span class="text-white">{msg.cc.join(", ")}</span>
                        </div>
                      )}
                      {msg.bcc?.length > 0 && (
                        <div class="flex gap-2">
                          <span class="text-slate-500 w-12 flex-shrink-0">
                            BCC
                          </span>
                          <span class="text-white">{msg.bcc.join(", ")}</span>
                        </div>
                      )}
                      <div class="flex gap-2">
                        <span class="text-slate-500 w-12 flex-shrink-0">
                          Date
                        </span>
                        <span class="text-white">
                          {new Date(msg.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div class="border-t border-slate-700 pt-3">
                      {msg.bodyHtml ? (
                        <div
                          class="text-slate-200 prose prose-invert prose-sm max-w-none break-words"
                          dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
                        />
                      ) : msg.bodyText ? (
                        <pre class="text-slate-200 whitespace-pre-wrap font-sans break-words">
                          {msg.bodyText}
                        </pre>
                      ) : (
                        <div class="text-slate-500 italic">No content</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {canLoadNextPage && (
            <div class="flex justify-center pt-4 pb-2">
              <button
                onClick={loadNextPage}
                class="text-sm px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700 hover:border-slate-600 shadow-sm"
              >
                Load older messages
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
