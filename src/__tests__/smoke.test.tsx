import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("smoke tests", () => {
  it("cn utility merges classes correctly", () => {
    const result = cn("px-4", "py-2", "px-6");
    expect(result).toBe("py-2 px-6");
  });

  it("cn handles conditional classes", () => {
    const result = cn("base", false && "hidden", "visible");
    expect(result).toBe("base visible");
  });
});
