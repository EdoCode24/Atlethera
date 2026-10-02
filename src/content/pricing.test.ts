import { describe, expect, it } from "vitest";
import { packages } from "./pricing";

describe("package data", () => {
  it("never shows an amount that was not set on purpose", () => {
    for (const pkg of packages) {
      if (pkg.price.status === "tbd") continue;
      expect(pkg.price.monthly).toBeGreaterThan(0);
      expect(["TRY", "USD", "EUR"]).toContain(pkg.price.currency);
    }
  });

  it("offers a sport choice only in the Coach package", () => {
    expect(packages.map((p) => p.id)).toEqual(["pt", "coach"]);
    expect(packages.find((p) => p.id === "pt")?.sports).toBeUndefined();
    expect(packages.find((p) => p.id === "coach")?.sports).toEqual(["american-football", "flag-football"]);
  });
});
