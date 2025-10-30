// src/lib/validation.ts

export type ValidationResult = {
    source: "server-ai";
    valid: boolean;
    reason: string;
  };
  
  export class AIConnectionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AIConnectionError";
    }
  }
  
  /**
   * Calls the backend AI validator. 
   * - On ANY network/server error → throws AIConnectionError (no fallback).
   * - On non-OK HTTP → throws AIConnectionError with short message.
   */
  export async function validateRoleStrict(text: string): Promise<ValidationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
  
    try {
      const res = await fetch("/api/validate-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
  
      clearTimeout(timeoutId);
  
      if (!res.ok) {
        let msg = `AI validator HTTP ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) msg = String(data.error);
        } catch {}
        throw new AIConnectionError(msg);
      }
  
      const data = (await res.json()) as { valid?: boolean; reason?: string };
      if (typeof data?.valid !== "boolean") {
        throw new AIConnectionError("AI validator returned malformed data");
      }
      return { source: "server-ai", valid: data.valid, reason: data.reason || "" };
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new AIConnectionError("AI validator timed out");
      }
      if (err instanceof AIConnectionError) throw err;
      throw new AIConnectionError("Cannot reach AI validator");
    }
  }
  // --- Suggestion validation (client -> server AI) ---
export async function validateSuggestionStrict(
  text: string,
  ctx: { title: string; description: string },
  roleCtx?: { era: string; settingType: string; year: string }
): Promise<ValidationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch("/api/validate-suggestion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        title: ctx.title,
        description: ctx.description,
        era: roleCtx?.era || "",
        settingType: roleCtx?.settingType || "",
        year: roleCtx?.year || ""
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      let msg = `AI validator HTTP ${res.status}`;
      try {
        const data = await res.json();
        if (data?.error) msg = String(data.error);
      } catch {}
      throw new AIConnectionError(msg);
    }

    const data = (await res.json()) as { valid?: boolean; reason?: string };
    if (typeof data?.valid !== "boolean") {
      throw new AIConnectionError("AI validator returned malformed data");
    }
    return { source: "server-ai", valid: data.valid, reason: data.reason || "" };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new AIConnectionError("AI validator timed out");
    }
    if (err instanceof AIConnectionError) throw err;
    throw new AIConnectionError("Cannot reach AI validator");
  }
}
