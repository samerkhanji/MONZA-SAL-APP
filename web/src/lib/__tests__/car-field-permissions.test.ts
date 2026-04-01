import { describe, it, expect } from "vitest";
import {
  canEditDmsWarrantyOnCar,
  canEditMonzaWarrantyOnCar,
  canEditPdiStatusOnCar,
  canOpenCarEditDialog,
  profileMatchesMonzaWarrantyEditor,
} from "@/lib/car-field-permissions";

describe("car-field-permissions", () => {
  it("matches Lara/Samaya by substring on full_name", () => {
    expect(profileMatchesMonzaWarrantyEditor("Lara M.")).toBe(true);
    expect(profileMatchesMonzaWarrantyEditor("SAMAYA")).toBe(true);
    expect(profileMatchesMonzaWarrantyEditor("Other")).toBe(false);
  });

  it("Monza warranty: owner, or assistant+Lara/Samaya name", () => {
    expect(canEditMonzaWarrantyOnCar("owner", null)).toBe(true);
    expect(canEditMonzaWarrantyOnCar("assistant", "Lara")).toBe(true);
    expect(canEditMonzaWarrantyOnCar("assistant", "No")).toBe(false);
    expect(canEditMonzaWarrantyOnCar("sales_ops", null)).toBe(false);
  });

  it("DMS warranty: owner or khalil_hybrid", () => {
    expect(canEditDmsWarrantyOnCar("owner")).toBe(true);
    expect(canEditDmsWarrantyOnCar("khalil_hybrid")).toBe(true);
    expect(canEditDmsWarrantyOnCar("assistant")).toBe(false);
  });

  it("PDI: owner, assistant, garage_manager", () => {
    expect(canEditPdiStatusOnCar("owner")).toBe(true);
    expect(canEditPdiStatusOnCar("assistant")).toBe(true);
    expect(canEditPdiStatusOnCar("garage_manager")).toBe(true);
    expect(canEditPdiStatusOnCar("sales_ops")).toBe(false);
  });

  it("canOpenCarEditDialog includes sales_ops and monza/khalil paths", () => {
    expect(canOpenCarEditDialog("sales_ops", null)).toBe(true);
    expect(canOpenCarEditDialog("assistant", "Samaya")).toBe(true);
    expect(canOpenCarEditDialog("khalil_hybrid", null)).toBe(true);
    expect(canOpenCarEditDialog("it", null)).toBe(false);
  });
});
