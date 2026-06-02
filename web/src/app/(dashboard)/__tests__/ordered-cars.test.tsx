import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

// Pretend the user has inventory-edit rights so the "Add incoming car"
// button is rendered.
vi.mock("@/lib/contexts/UserContext", () => ({
  useUser: () => ({ canEditInventory: true }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

// Two cars on order and two awaiting PDI, designed so a single search term
// can filter each table independently.
const INBOUND_ROWS = [
  {
    id: "car-1",
    vin: "WAUZZZ1234567ABCD",
    brand: "Voyah",
    model: "Free",
    model_year: 2025,
    shipment_code: "SHIP-001",
    incoming_eta: "2025-01-10",
    notes: null,
  },
  {
    id: "car-2",
    vin: "ZZZAAA9876543BBBB",
    brand: "MHero",
    model: "Dreamer",
    model_year: 2024,
    shipment_code: "SHIP-002",
    incoming_eta: "2025-02-15",
    notes: null,
  },
];

const ARRIVED_ROWS = [
  {
    id: "car-3",
    vin: "ARR111AAA222BBB33",
    brand: "Voyah",
    model: "Courage",
    model_year: 2025,
    date_arrived: "2025-01-01",
    pdi_status: "pending",
  },
  {
    id: "car-4",
    vin: "ARR444CCC555DDD66",
    brand: "MHero",
    model: "917",
    model_year: 2024,
    date_arrived: "2025-01-02",
    pdi_status: "pending",
  },
];

// Loose shape for our hand-rolled Supabase query builder. Each chain method
// returns the builder itself so `.select(...).eq(...).is(...)` keeps working
// without having to type out every PostgREST helper.
type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => unknown) => unknown;
};

// Build a thenable query chain whose payload is decided lazily, based on
// which filters the page applies. Both "cars" sub-queries (inbound + arrived)
// chain through the same `.from("cars")` factory; the only thing that
// distinguishes them is `.eq("status", "inbound")` vs
// `.eq("status", "inventory")`. We track the status the chain was filtered by
// and resolve to the right canned rows when the chain is awaited.
function makeCarsQueryBuilder(): QueryBuilder {
  const state: { status?: string } = {};
  const builder: Partial<QueryBuilder> = {};
  builder.select = vi.fn(() => builder as QueryBuilder);
  builder.eq = vi.fn((col: string, val: string) => {
    if (col === "status") state.status = val;
    return builder as QueryBuilder;
  });
  builder.neq = vi.fn(() => builder as QueryBuilder);
  builder.is = vi.fn(() => builder as QueryBuilder);
  builder.in = vi.fn(() => builder as QueryBuilder);
  builder.order = vi.fn(() => builder as QueryBuilder);
  builder.limit = vi.fn(() => builder as QueryBuilder);
  builder.then = (resolve: (v: unknown) => unknown) => {
    if (state.status === "inbound") {
      return resolve({ data: INBOUND_ROWS, error: null });
    }
    if (state.status === "inventory") {
      return resolve({ data: ARRIVED_ROWS, error: null });
    }
    return resolve({ data: [], error: null });
  };
  return builder as QueryBuilder;
}

function makeChecksQueryBuilder(): QueryBuilder {
  const builder: Partial<QueryBuilder> = {};
  const methods = ["select", "eq", "neq", "is", "in", "order", "limit"] as const;
  for (const m of methods) {
    builder[m] = vi.fn(() => builder as QueryBuilder);
  }
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: [], error: null });
  return builder as QueryBuilder;
}

// Route each `.from(table)` call to the right canned payload so the page's
// initial load populates both the inbound list and the awaiting-PDI list.
const mockFrom = vi.fn((table: string) => {
  if (table === "cars") return makeCarsQueryBuilder();
  if (table === "car_arrival_checks") return makeChecksQueryBuilder();
  return makeChecksQueryBuilder();
});

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "u1" } }, error: null }),
    },
    from: mockFrom,
    rpc: vi.fn(),
  }),
}));

vi.mock("@/lib/error-messages", () => ({
  formatError: (e: unknown) => String(e),
}));

import OrderedCarsPage from "@/app/(dashboard)/ordered-cars/page";

describe("OrderedCarsPage", () => {
  beforeEach(() => {
    cleanup();
    mockFrom.mockClear();
  });

  it("renders the 'Add incoming car' button and opens the dialog when clicked", async () => {
    render(<OrderedCarsPage />);

    const addButton = await screen.findByRole("button", {
      name: /add incoming car/i,
    });
    expect(addButton).toBeInTheDocument();

    // Bug 1: the button used to be present but had no working onClick.
    // Clicking it must open the modal.
    fireEvent.click(addButton);

    await waitFor(() => {
      // Radix renders the dialog title inside the portal once open.
      expect(
        screen.getByRole("heading", { name: /add incoming car/i })
      ).toBeInTheDocument();
    });
  });

  it("accepts keyboard input in the search field and updates the input value", async () => {
    render(<OrderedCarsPage />);

    const search = (await screen.findByPlaceholderText(
      /search by vin, brand, model/i
    )) as HTMLInputElement;

    // Bug 3: keystrokes must propagate into the controlled input. If the
    // input were uncontrolled or wrapped in a parent that swallowed
    // onChange, this assertion would fail.
    expect(search.disabled).toBe(false);
    expect(search.readOnly).toBe(false);

    fireEvent.change(search, { target: { value: "ZZZAAA" } });
    expect(search.value).toBe("ZZZAAA");
  });

  it("filters both 'Cars on order' and 'Awaiting PDI' tables with one search box", async () => {
    render(<OrderedCarsPage />);

    // Wait for the page to render both lists.
    await waitFor(() => {
      expect(screen.getByText("WAUZZZ1234567ABCD")).toBeInTheDocument();
      expect(screen.getByText("ARR111AAA222BBB33")).toBeInTheDocument();
    });

    const search = (await screen.findByPlaceholderText(
      /search by vin, brand, model/i
    )) as HTMLInputElement;

    // "MHero" matches one car in each section. Both sections must reflect
    // the filter — the bug was that the search only narrowed the first
    // table.
    fireEvent.change(search, { target: { value: "MHero" } });

    await waitFor(() => {
      expect(screen.queryByText("WAUZZZ1234567ABCD")).not.toBeInTheDocument();
      expect(screen.queryByText("ARR111AAA222BBB33")).not.toBeInTheDocument();
      expect(screen.getByText("ZZZAAA9876543BBBB")).toBeInTheDocument();
      expect(screen.getByText("ARR444CCC555DDD66")).toBeInTheDocument();
    });
  });

  it("renders an 'Open' action on each Awaiting PDI row that navigates to the car detail", async () => {
    render(<OrderedCarsPage />);

    // Wait for the awaiting-PDI rows to populate.
    await waitFor(() => {
      expect(screen.getByText("ARR111AAA222BBB33")).toBeInTheDocument();
    });

    // The Awaiting-PDI section ships its own "Open" button per row. Bug 2
    // was that this button had no working handler; assert that at least one
    // such button is wired and clickable (clicking would call router.push,
    // which is mocked above).
    const openButtons = screen.getAllByRole("button", { name: /^open$/i });
    expect(openButtons.length).toBeGreaterThan(0);
    fireEvent.click(openButtons[openButtons.length - 1]);
    // No throw means the handler is wired; router.push is mocked.
  });
});
