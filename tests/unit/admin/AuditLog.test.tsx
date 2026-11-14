// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuditRow } from "@/lib/admin/members";

/** F13.4 (dış #18): süzgeç hızla değişince geç dönen eski sorgu tabloyu ezmemeli. */
const pages = vi.hoisted(() => [] as { filters: unknown; resolve: (rows: AuditRow[]) => void }[]);
vi.mock("@/lib/admin/members", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/members")>();
  return {
    ...actual,
    fetchAuditPage: (filters: unknown) =>
      new Promise((resolve) => pages.push({ filters, resolve: (rows) => resolve({ rows, cursor: null }) })),
  };
});

const { AuditLog } = await import("@/components/admin/audit/AuditLog");

const row = (id: string, actorEmail: string): AuditRow => ({
  id,
  timestampMs: 0,
  actorEmail,
  action: "MEMBER_APPROVED",
  resourceType: "users",
  resourceId: "u",
  severity: "INFO",
  metadata: {},
  networkId: null,
});

describe("AuditLog (F13.4)", () => {
  it("geç dönen eski süzgeç yanıtı yeni süzgecin sonuçlarını ezmez", async () => {
    render(<AuditLog />);
    expect(pages).toHaveLength(1); // "Tümü"
    fireEvent.change(screen.getByLabelText("Önem"), { target: { value: "CRITICAL" } });
    expect(pages).toHaveLength(2);

    await act(async () => pages[1].resolve([row("2", "kritik@pediatrist.test")]));
    expect(screen.getByText("kritik@pediatrist.test")).toBeTruthy();

    await act(async () => pages[0].resolve([row("1", "eski@pediatrist.test")]));
    expect(screen.queryByText("eski@pediatrist.test")).toBeNull();
    expect(screen.getByText("kritik@pediatrist.test")).toBeTruthy();
  });
});
