/**
 * Client for the API's SSE endpoints (generate, validate). POSTs a JSON body
 * and parses the `data:` event stream, invoking callbacks per event type.
 */

interface StreamCallbacks<TResult> {
  onChunk: (content: string) => void;
  onDone: (result: TResult) => void;
  onError: (error: string) => void;
}

export async function streamJsonEvents<TResult>(
  url: string,
  body: unknown,
  { onChunk, onDone, onError }: StreamCallbacks<TResult>,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Server responded with ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleEvent = (raw: string) => {
    // An SSE record may contain multiple "data:" lines; concatenate them.
    const dataPayload = raw
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(l.indexOf(":") + 1).replace(/^ /, ""))
      .join("\n");
    if (!dataPayload) return;

    let event: any;
    try {
      event = JSON.parse(dataPayload);
    } catch {
      // A genuinely incomplete/invalid record — skip it.
      return;
    }

    if (event.type === "chunk") {
      onChunk(event.content ?? "");
    } else if (event.type === "done") {
      onDone(event.result as TResult);
    } else if (event.type === "error") {
      onError(event.error ?? "Unknown error");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    // Decode incrementally so multi-byte UTF-8 split across reads isn't corrupted.
    buffer += decoder.decode(value, { stream: !done });

    // Process every complete SSE record (records are separated by a blank line).
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const record = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (record.trim()) handleEvent(record);
    }

    if (done) {
      // Flush any trailing record that wasn't newline-terminated.
      if (buffer.trim()) handleEvent(buffer);
      break;
    }
  }
}
