/**
 * Tests for the Debugger module
 */

import {
  Debugger,
  Breakpoint,
  DebugEvent,
  getDebugger,
  resetDebugger,
} from "../src/debugger";

describe("Debugger", () => {
  let debugger_: Debugger;

  beforeEach(() => {
    resetDebugger();
    debugger_ = getDebugger();
  });

  describe("breakpoint management", () => {
    it("should add a breakpoint", () => {
      const bp = debugger_.addBreakpoint(10);
      expect(bp.id).toBe(1);
      expect(bp.line).toBe(10);
      expect(bp.enabled).toBe(true);
      expect(bp.hitCount).toBe(0);
    });

    it("should add a breakpoint with file", () => {
      const bp = debugger_.addBreakpoint(10, "test.lea");
      expect(bp.file).toBe("test.lea");
    });

    it("should add a breakpoint with condition", () => {
      const bp = debugger_.addBreakpoint(10, undefined, "x > 5");
      expect(bp.condition).toBe("x > 5");
    });

    it("should list breakpoints", () => {
      debugger_.addBreakpoint(10);
      debugger_.addBreakpoint(20, "test.lea");
      debugger_.addBreakpoint(30);

      const bps = debugger_.listBreakpoints();
      expect(bps.length).toBe(3);
      expect(bps[0].line).toBe(10);
      expect(bps[1].line).toBe(20);
      expect(bps[2].line).toBe(30);
    });

    it("should remove a breakpoint", () => {
      const bp = debugger_.addBreakpoint(10);
      expect(debugger_.listBreakpoints().length).toBe(1);

      const removed = debugger_.removeBreakpoint(bp.id);
      expect(removed).toBe(true);
      expect(debugger_.listBreakpoints().length).toBe(0);
    });

    it("should return false when removing non-existent breakpoint", () => {
      const removed = debugger_.removeBreakpoint(999);
      expect(removed).toBe(false);
    });

    it("should clear all breakpoints", () => {
      debugger_.addBreakpoint(10);
      debugger_.addBreakpoint(20);
      debugger_.addBreakpoint(30);
      expect(debugger_.listBreakpoints().length).toBe(3);

      debugger_.clearBreakpoints();
      expect(debugger_.listBreakpoints().length).toBe(0);
    });

    it("should enable and disable breakpoints", () => {
      const bp = debugger_.addBreakpoint(10);
      expect(bp.enabled).toBe(true);

      debugger_.disableBreakpoint(bp.id);
      const updated = debugger_.listBreakpoints()[0];
      expect(updated.enabled).toBe(false);

      debugger_.enableBreakpoint(bp.id);
      const enabled = debugger_.listBreakpoints()[0];
      expect(enabled.enabled).toBe(true);
    });

    it("should find breakpoint at location", () => {
      debugger_.addBreakpoint(10);
      debugger_.addBreakpoint(20, "test.lea");

      const found1 = debugger_.hasBreakpoint(10);
      expect(found1).not.toBeNull();
      expect(found1?.line).toBe(10);

      const found2 = debugger_.hasBreakpoint(20, "test.lea");
      expect(found2).not.toBeNull();
      expect(found2?.line).toBe(20);

      const notFound = debugger_.hasBreakpoint(30);
      expect(notFound).toBeNull();
    });

    it("should not find disabled breakpoints", () => {
      const bp = debugger_.addBreakpoint(10);
      debugger_.disableBreakpoint(bp.id);

      const found = debugger_.hasBreakpoint(10);
      expect(found).toBeNull();
    });
  });

  describe("watch expressions", () => {
    it("should add a watch expression", () => {
      debugger_.addWatch("x");
      expect(debugger_.listWatches()).toContain("x");
    });

    it("should not add duplicate watch expressions", () => {
      debugger_.addWatch("x");
      debugger_.addWatch("x");
      expect(debugger_.listWatches().length).toBe(1);
    });

    it("should remove a watch expression", () => {
      debugger_.addWatch("x");
      debugger_.addWatch("y");
      expect(debugger_.listWatches().length).toBe(2);

      const removed = debugger_.removeWatch("x");
      expect(removed).toBe(true);
      expect(debugger_.listWatches()).not.toContain("x");
      expect(debugger_.listWatches()).toContain("y");
    });

    it("should return false when removing non-existent watch", () => {
      const removed = debugger_.removeWatch("nonexistent");
      expect(removed).toBe(false);
    });

    it("should clear all watches", () => {
      debugger_.addWatch("x");
      debugger_.addWatch("y");
      debugger_.addWatch("z");
      expect(debugger_.listWatches().length).toBe(3);

      debugger_.clearWatches();
      expect(debugger_.listWatches().length).toBe(0);
    });
  });

  describe("value history", () => {
    it("should record values", () => {
      debugger_.recordValue("x", 42);
      debugger_.recordValue("y", "hello");

      const history = debugger_.getValueHistory();
      expect(history.length).toBe(2);
      expect(history[0]).toEqual({ name: "x", value: 42 });
      expect(history[1]).toEqual({ name: "y", value: "hello" });
    });

    it("should get the last value", () => {
      debugger_.recordValue("x", 42);
      debugger_.recordValue("y", "hello");

      const last = debugger_.getLastValue();
      expect(last).toEqual({ name: "y", value: "hello" });
    });

    it("should return null when no values recorded", () => {
      const last = debugger_.getLastValue();
      expect(last).toBeNull();
    });

    it("should clear value history", () => {
      debugger_.recordValue("x", 42);
      debugger_.recordValue("y", "hello");
      expect(debugger_.getValueHistory().length).toBe(2);

      debugger_.clearValueHistory();
      expect(debugger_.getValueHistory().length).toBe(0);
    });
  });

  describe("debug modes", () => {
    it("should start disabled", () => {
      expect(debugger_.isEnabled()).toBe(false);
    });

    it("should enable and disable", () => {
      debugger_.enable();
      expect(debugger_.isEnabled()).toBe(true);

      debugger_.disable();
      expect(debugger_.isEnabled()).toBe(false);
    });

    it("should start in run mode", () => {
      expect(debugger_.getMode()).toBe("run");
    });

    it("should change modes", () => {
      debugger_.setMode("step");
      expect(debugger_.getMode()).toBe("step");

      debugger_.setMode("paused");
      expect(debugger_.getMode()).toBe("paused");

      debugger_.continue();
      expect(debugger_.getMode()).toBe("run");
    });

    it("should track depth", () => {
      expect(debugger_.getDepth()).toBe(0);

      debugger_.enterPipeline();
      expect(debugger_.getDepth()).toBe(1);

      debugger_.enterPipeline();
      expect(debugger_.getDepth()).toBe(2);

      debugger_.exitPipeline();
      expect(debugger_.getDepth()).toBe(1);

      debugger_.exitPipeline();
      expect(debugger_.getDepth()).toBe(0);
    });
  });

  describe("notify", () => {
    it("should return true when disabled", async () => {
      const result = await debugger_.notify({ type: "pipe_stage" });
      expect(result).toBe(true);
    });

    it("should hit breakpoint when enabled", async () => {
      debugger_.enable();
      debugger_.addBreakpoint(10);

      let hitBreakpoint = false;
      debugger_.setCallback(async (event: DebugEvent) => {
        hitBreakpoint = event.type === "breakpoint_hit";
        return false; // Stop execution
      });

      const result = await debugger_.notify({
        type: "pipe_stage",
        location: { line: 10 },
      });

      expect(result).toBe(false);
      expect(hitBreakpoint).toBe(true);
    });

    it("should not hit disabled breakpoint", async () => {
      debugger_.enable();
      const bp = debugger_.addBreakpoint(10);
      debugger_.disableBreakpoint(bp.id);

      const result = await debugger_.notify({
        type: "pipe_stage",
        location: { line: 10 },
      });

      expect(result).toBe(true); // Should continue
    });

    it("should stop when stepping", async () => {
      debugger_.enable();
      debugger_.step();

      let stepped = false;
      debugger_.setCallback(async (event: DebugEvent) => {
        stepped = event.type === "step_complete";
        return false;
      });

      const result = await debugger_.notify({ type: "pipe_stage" });
      expect(result).toBe(false);
      expect(stepped).toBe(true);
    });
  });

  describe("formatters", () => {
    it("should format values", () => {
      expect(debugger_.formatValue(42)).toBe("42");
      expect(debugger_.formatValue("hello")).toBe("hello");
      expect(debugger_.formatValue([1, 2, 3])).toBe("[1, 2, 3]");
    });

    it("should truncate long values", () => {
      const longArray = Array.from({ length: 100 }, (_, i) => i);
      const formatted = debugger_.formatValue(longArray, 30);
      expect(formatted.length).toBeLessThanOrEqual(30);
      expect(formatted.endsWith("...")).toBe(true);
    });

    it("should format breakpoints", () => {
      const bp = debugger_.addBreakpoint(10, "test.lea", "x > 5");
      const formatted = debugger_.formatBreakpoint(bp);
      expect(formatted).toContain("#1");
      expect(formatted).toContain("test.lea:10");
      expect(formatted).toContain("x > 5");
    });
  });
});

describe("getDebugger", () => {
  it("should return the same instance", () => {
    resetDebugger();
    const d1 = getDebugger();
    const d2 = getDebugger();
    expect(d1).toBe(d2);
  });

  it("should return new instance after reset", () => {
    const d1 = getDebugger();
    resetDebugger();
    const d2 = getDebugger();
    expect(d1).not.toBe(d2);
  });
});
