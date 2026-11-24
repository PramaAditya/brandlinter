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

  it("never exceeds maxConcurrency when a new caller arrives during waiter wake-up", async () => {
    const sem = new Semaphore(1);
    let active = 0;
    let maxActive = 0;
    const gate1 = Promise.withResolvers<void>();
    const gate2 = Promise.withResolvers<void>();
    const gate3 = Promise.withResolvers<void>();

    const t1 = sem.run(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await gate1.promise;
      active--;
    });

    const t2 = sem.run(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await gate2.promise;
      active--;
    });

    await Promise.resolve();
    gate1.resolve();
    // New caller arrives synchronously right as t1 finishes and wakes t2
    const t3 = sem.run(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await gate3.promise;
      active--;
    });

    await t1;
    expect(maxActive).toBe(1);
    gate2.resolve();
    await t2;
    expect(maxActive).toBe(1);
    gate3.resolve();
    await t3;
    expect(maxActive).toBe(1);
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
