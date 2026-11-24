import { describe, it, expect, vi, afterEach } from "vitest";
import { checkDomainDoh } from "../src/providers/domain/doh.js";
import { checkDomainRdap } from "../src/providers/domain/rdap.js";

describe("checkDomainDoh", () => {
  afterEach(() => vi.restoreAllMocks());

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
