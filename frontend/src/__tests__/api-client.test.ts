import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, setToken } from "@/lib/api";

describe("api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("surfaces validation errors with field detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            detail: "Some fields need attention.",
            errors: [{ field: "company.name", message: "Company name is required" }],
          }),
          { status: 422, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(api.post("/projects", {})).rejects.toBeInstanceOf(ApiError);
    try {
      await api.post("/projects", {});
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.status).toBe(422);
      expect(apiError.detail).toBe("Some fields need attention.");
      expect(apiError.fieldErrors[0].field).toBe("company.name");
    }
  });

  it("clears the session token on 401", async () => {
    setToken("expired-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: "Invalid or expired session" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(api.get("/dashboard")).rejects.toBeInstanceOf(ApiError);
    expect(localStorage.getItem("marketpulse-token")).toBeNull();
  });

  it("reports a friendly message when the API is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(api.get("/dashboard")).rejects.toThrow(/Cannot reach the MarketPulse API/);
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true, projects: 2 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const result = await api.get<{ ok: boolean; projects: number }>("/dashboard");
    expect(result).toEqual({ ok: true, projects: 2 });
  });
});
