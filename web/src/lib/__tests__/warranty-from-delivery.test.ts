import { describe, it, expect } from "vitest";
import {
  monzaWarrantySlotsEmpty,
  warrantyExpiryFromDeliveryYmd,
} from "@/lib/warranty-from-delivery";
import type { CarDisplay } from "@/types/database";

describe("warranty-from-delivery", () => {
  it("adds whole years in UTC", () => {
    expect(warrantyExpiryFromDeliveryYmd("2024-03-15", 5)).toBe("2029-03-15");
    expect(warrantyExpiryFromDeliveryYmd("2024-03-15", 8)).toBe("2032-03-15");
  });

  it("monzaWarrantySlotsEmpty respects any populated Monza field", () => {
    const base = { id: "1" } as unknown as CarDisplay;
    expect(monzaWarrantySlotsEmpty(base)).toBe(true);
    expect(
      monzaWarrantySlotsEmpty({
        ...base,
        warranty_monza_start_date: "2024-01-01",
      } as CarDisplay)
    ).toBe(false);
  });
});
