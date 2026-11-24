import { describe, it, expect, vi, afterEach } from "vitest";
import { checkDomainDoh } from "../src/providers/domain/doh.js";
import { checkDomain, checkDomainRdap } from "../src/providers/domain/rdap.js";

describe("checkDomainDoh", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns available on NXDOMAIN (Status 3)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ Status: 3 }), { status: 200 })
      )
    );
    const res = await checkDomainDoh("nymlint", "dev", "https://dns.google/resolve");
    expect(res.status).toBe("available");
    expect(res.domain).toBe("nymlint.dev");
    expect(res.source).toBe("doh");
  });

  it("returns taken on Status 0 with Answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ Status: 0, Answer: [{ data: "ns1.example.com." }] }),
          { status: 200 }
        )
      )
    );
    const res = await checkDomainDoh("example", "com", "https://dns.google/resolve");
    expect(res.status).toBe("taken");
  });

  it("returns unknown on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const res = await checkDomainDoh("nymlint", "dev", "https://dns.google/resolve");
    expect(res.status).toBe("unknown");
  });

  it("aborts stalled res.json() inside withTimeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        const deferred = Promise.withResolvers<unknown>();
        init?.signal?.addEventListener("abort", () => {
          deferred.reject(new DOMException("The operation was aborted", "AbortError"));
        });
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => deferred.promise,
        } as unknown as Response);
      })
    );
    const promise = checkDomainDoh("nymlint", "dev", "https://dns.google/resolve", 50);
    await vi.advanceTimersByTimeAsync(60);
    const res = await promise;
    expect(res.status).toBe("unknown");
    expect(res.detail).toContain("aborted");
  });
});

describe("checkDomainRdap", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns available on HTTP 404 from RDAP", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    const res = await checkDomainRdap("nymlint", "com");
    expect(res.status).toBe("available");
    expect(res.source).toBe("rdap");
  });

  it("returns taken on HTTP 200 from RDAP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ldhName: "EXAMPLE.COM" }), { status: 200 }))
    );
    const res = await checkDomainRdap("example", "com");
    expect(res.status).toBe("taken");
  });

  it("returns unknown on HTTP 429 rate limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));
    const res = await checkDomainRdap("nymlint", "dev");
    expect(res.status).toBe("unknown");
  });
});

describe("checkDomain", () => {
  afterEach(() => vi.restoreAllMocks());

  it("corroborates non-DIRECT_RDAP available results with DoH and returns taken if DoH says taken", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://rdap.org/")) {
        return new Response("", { status: 404 });
      }
      return new Response(
        JSON.stringify({ Status: 0, Answer: [{ data: "ns1.example.xyz." }] }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await checkDomain("takenapp", "xyz", "https://dns.google/resolve");
    expect(res.status).toBe("taken");
    expect(res.source).toBe("doh");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("queries Google Registry directly for .dev/.app and sends a User-Agent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await checkDomain("nymlint", "dev", "https://dns.google/resolve");
    expect(res.status).toBe("available");
    expect(res.source).toBe("rdap");
    // No rdap.org hop and no DoH corroboration: Google Registry is authoritative.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://pubapi.registry.google/rdap/domain/nymlint.dev");
    expect((init.headers as Record<string, string>)["User-Agent"]).toContain("brandlinter");
  });

  it("trusts DIRECT_RDAP available without calling DoH", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await checkDomain("nymlint", "com", "https://dns.google/resolve");
    expect(res.status).toBe("available");
    expect(res.source).toBe("rdap");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("combines RDAP and DoH details when both return unknown", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("rdap")) {
        return new Response("", { status: 429 });
      }
      return new Response(JSON.stringify({ Status: 2 }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await checkDomain("nymlint", "dev", "https://dns.google/resolve");
    expect(res.status).toBe("unknown");
    expect(res.detail).toContain("HTTP 429");
    expect(res.detail).toContain("DNS Status 2");
  });
});
