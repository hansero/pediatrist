// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "@/components/ui/Tabs";

const items = [
  { id: "a", label: "Canlı", content: <p>Canlı içerik</p> },
  { id: "b", label: "Geçmiş", content: <p>Geçmiş içerik</p> },
  { id: "c", label: "Kapalı", content: <p>Kapalı içerik</p>, disabled: true },
  { id: "d", label: "Rapor", content: <p>Rapor içerik</p> },
];

describe("Tabs", () => {
  it("ARIA ilişkileri: tablist adı, aria-selected, aria-controls ↔ tabpanel, roving tabindex", () => {
    render(<Tabs label="Yoklama görünümleri" items={items} />);
    expect(screen.getByRole("tablist", { name: "Yoklama görünümleri" })).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false", "false", "false"]);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1, -1]);
    const panel = screen.getByRole("tabpanel");
    expect(panel.id).toBe(tabs[0].getAttribute("aria-controls"));
    expect(panel.getAttribute("aria-labelledby")).toBe(tabs[0].id);
    expect(panel.textContent).toBe("Canlı içerik");
    expect(screen.queryByText("Geçmiş içerik")).toBeNull();
  });

  it("ok tuşları döngüsel gezer ve devre dışı sekmeyi atlar; Home/End; odak taşınır", () => {
    const onChange = vi.fn();
    render(<Tabs label="Görünümler" items={items} onChange={onChange} />);
    const tab = (name: string) => screen.getByRole("tab", { name });

    tab("Canlı").focus();
    fireEvent.keyDown(tab("Canlı"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab("Geçmiş"));
    expect(tab("Geçmiş").getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(tab("Geçmiş"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab("Rapor")); // "Kapalı" atlandı

    fireEvent.keyDown(tab("Rapor"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab("Canlı")); // döngü

    fireEvent.keyDown(tab("Canlı"), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tab("Rapor"));

    fireEvent.keyDown(tab("Rapor"), { key: "Home" });
    expect(document.activeElement).toBe(tab("Canlı"));
    fireEvent.keyDown(tab("Canlı"), { key: "End" });
    expect(document.activeElement).toBe(tab("Rapor"));
    expect(screen.getByRole("tabpanel").textContent).toBe("Rapor içerik");

    expect(onChange.mock.calls.map((c) => c[0])).toEqual(["b", "d", "a", "d", "a", "d"]);
  });

  it("kontrollü kullanım: value dışarıdan gelir; tıklama yalnızca onChange çağırır", () => {
    const onChange = vi.fn();
    render(<Tabs label="Görünümler" items={items} value="b" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Rapor" }));
    expect(onChange).toHaveBeenCalledWith("d");
    expect(screen.getByRole("tab", { name: "Geçmiş" }).getAttribute("aria-selected")).toBe("true");
  });
});
