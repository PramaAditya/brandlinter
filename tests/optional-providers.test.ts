import { describe, it, expect, vi, afterEach } from "vitest";
import { checkPorkbunDomain } from "../src/providers/optional/porkbun.js";
import { checkAppStore } from "../src/providers/optional/appstores.js";
import { checkSocialHandles } from "../src/providers/optional/social.js";
import { buildTrademarkLinks } from "../src/providers/optional/trademark.js";

describe("optional providers", () => {
  afterEach(() => vi.restoreAllMocks());

  it("checkPorkbunDomain parses avail yes/no", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "SUCCESS", response: { avail: "yes", price: "10.00" } }), { status: 200 })
      )
    );
    const res = await checkPorkbunDomain("nymlint", "com", "pk", "sk");
    expect(res.status).toBe("available");
    expect(res.source).toBe("porkbun");
  });

  it("checkAppStore uses configurable country and detects exact match", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          resultCount: 1,
          results: [{ trackName: "AnyDisplay", bundleId: "com.example.anydisplay" }],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await checkAppStore("anydisplay", "us");
    expect(res.status).toBe("taken");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("country=us"),
      expect.any(Object)
    );
  });

  it("checkAppStore does not false-positive on substring bundleId matches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            resultCount: 2,
            results: [
              { trackName: "My AnyDisplay Pro", bundleId: "com.example.myanydisplayapp" },
              { trackName: "Other", bundleId: "com.anydisplay.other" },
            ],
          }),
          { status: 200 }
        )
      )
    );
    const res = await checkAppStore("anydisplay", "us");
    expect(res.status).toBe("available");
  });

  it("checkSocialHandles marks 404 available, 200 taken, 429 unknown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("x.com")) return new Response("", { status: 404 });
        if (url.includes("reddit.com")) return new Response("", { status: 200 });
        return new Response("", { status: 429 });
      })
    );
    const res = await checkSocialHandles("nymlint");
    expect(res.find((r) => r.platform === "X")?.status).toBe("available");
    expect(res.find((r) => r.platform === "Reddit")?.status).toBe("taken");
    expect(res.find((r) => r.platform === "Bluesky")?.status).toBe("unknown");
  });

  it("checkSocialHandles returns unknown on authwall redirect URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("linkedin.com")) {
          const res = new Response("", { status: 200 });
          Object.defineProperty(res, "url", {
            value: "https://www.linkedin.com/authwall?trk=guest_homepage",
          });
          return res;
        }
        if (url.includes("x.com")) {
          const res = new Response("", { status: 200 });
          Object.defineProperty(res, "url", {
            value: "https://x.com/i/flow/login",
          });
          return res;
        }
        return new Response("", { status: 404 });
      })
    );
    const res = await checkSocialHandles("nymlint");
    const linkedin = res.find((r) => r.platform === "LinkedIn");
    const x = res.find((r) => r.platform === "X");
    expect(linkedin?.status).toBe("unknown");
    expect(linkedin?.detail).toBe("Redirected to authwall");
    expect(x?.status).toBe("unknown");
    expect(x?.detail).toBe("Redirected to authwall");
  });

  it("buildTrademarkLinks returns heuristic search URLs with disclaimer", () => {
    const res = buildTrademarkLinks("nymlint");
    expect(res.disclaimer).toContain("not legal advice");
    expect(res.links.length).toBeGreaterThanOrEqual(3);
  });
});
