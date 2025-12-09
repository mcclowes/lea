import { lea, leaAsync, createLea } from "../src/api";

describe("lea tagged template", () => {
  describe("value interpolation", () => {
    it("should interpolate arrays", () => {
      const nums = [1, 2, 3];
      const result = lea`${nums} /> map((x) -> x * 2)`;
      expect(result).toEqual([2, 4, 6]);
    });

    it("should interpolate numbers", () => {
      const threshold = 2;
      const nums = [1, 2, 3, 4, 5];
      const result = lea`${nums} /> filter((x) -> x > ${threshold})`;
      expect(result).toEqual([3, 4, 5]);
    });

    it("should interpolate strings", () => {
      const name = "World";
      const result = lea`"Hello " ++ ${name}`;
      expect(result).toBe("Hello World");
    });

    it("should interpolate records", () => {
      const user = { name: "Max", age: 99 };
      const result = lea`${user}.name`;
      expect(result).toBe("Max");
    });
  });

  describe("function interpolation", () => {
    it("should interpolate JS functions", () => {
      const double = (x: number) => x * 2;
      const nums = [1, 2, 3];
      const result = lea`${nums} /> map(${double})`;
      expect(result).toEqual([2, 4, 6]);
    });

    it("should interpolate arrow functions with multiple args", () => {
      const add = (a: number, b: number) => a + b;
      const result = lea`${add}(10, 5)`;
      expect(result).toBe(15);
    });

    it("should work with filter", () => {
      const isEven = (x: number) => x % 2 === 0;
      const nums = [1, 2, 3, 4, 5, 6];
      const result = lea`${nums} /> filter(${isEven})`;
      expect(result).toEqual([2, 4, 6]);
    });
  });

  describe("complex expressions", () => {
    it("should handle chained operations", () => {
      const nums = [1, 2, 3, 4, 5];
      const result = lea`
        ${nums}
          /> filter((x) -> x > 2)
          /> map((x) -> x * x)
          /> reduce(0, (acc, x) -> acc + x)
      `;
      expect(result).toBe(50); // 3*3 + 4*4 + 5*5 = 9 + 16 + 25 = 50
    });

    it("should handle spread pipe", () => {
      const nums = [1, 2, 3];
      const result = lea`${nums} />>> (x) -> x * 2`;
      expect(result).toEqual([2, 4, 6]);
    });
  });
});

describe("leaAsync", () => {
  it("should handle async operations", async () => {
    const result = await leaAsync`
      await delay(10)
      42
    `;
    expect(result).toBe(42);
  });
});

describe("createLea", () => {
  it("should create context with bindings", () => {
    const ctx = createLea({
      data: [10, 20, 30],
      multiplier: 2,
    });
    const result = ctx.run(`data /> map((x) -> x * multiplier)`);
    expect(result).toEqual([20, 40, 60]);
  });

  it("should allow adding bindings after creation", () => {
    const ctx = createLea();
    ctx.set("x", 10);
    ctx.set("y", 20);
    const result = ctx.run(`x + y`);
    expect(result).toBe(30);
  });

  it("should allow JS functions as bindings", () => {
    const ctx = createLea({
      double: (x: number) => x * 2,
      nums: [1, 2, 3],
    });
    const result = ctx.run(`nums /> map(double)`);
    expect(result).toEqual([2, 4, 6]);
  });

  it("should support runAsync for await", async () => {
    const ctx = createLea();
    const result = await ctx.runAsync(`
      await delay(10)
      "done"
    `);
    expect(result).toBe("done");
  });
});
