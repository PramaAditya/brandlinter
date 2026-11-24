import { describe, it, expect, vi, afterEach } from "vitest";
import { Semaphore, withTimeout } from "../src/core/concurrency.js";

describe("Semaphore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("limits concurrent executions to maxConcurrency", async () => {
    const sem = new Semaphore(2);
    let active = 0;
    let maxActive = 0;
    const gates = Array.from({ length: 6 }, () => Promise.withResolvers<void>());

    const tasks = gates.map((gate) =>
      sem.run(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await gate.promise;
        active--;
        return true;
      })
    );

    await Promise.resolve();
    await Promise.resolve();
    expect(maxActive).toBeLessThanOrEqual(2);

    for (const gate of gates) {
      gate.resolve();
      await Promise.resolve();
    }

    const results = await Promise.all(tasks);
    expect(results).toHaveLength(6);
    expect(maxActive).toBe(2);
  });
});

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts when operation exceeds timeoutMs", async () => {
    vi.useFakeTimers();
    const { promise, reject } = Promise.withResolvers<string>();

    const timed = withTimeout((signal) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")));
      return promise;
    }, 20);

    const assertion = expect(timed).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
  });

  it("resolves normally before timeout", async () => {
    const res = await withTimeout(async () => "ok", 200);
    expect(res).toBe("ok");
  });
});
