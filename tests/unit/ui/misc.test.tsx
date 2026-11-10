// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Alert, DataTable, EmptyState, Field, ToastProvider, useToast } from "@/components/ui";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Field", () => {
  it("etiket kontrole bağlı; hata varken aria-invalid ve aria-describedby (ipucu + hata)", () => {
    render(
      <Field label="E-posta" hint="Kurumsal adresiniz" error="E-posta adresi geçersiz." required>
        {(p) => <input {...p} className="form-input" type="email" />}
      </Field>
    );
    const input = screen.getByLabelText(/E-posta/);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.hasAttribute("required")).toBe(true);
    const described = input
      .getAttribute("aria-describedby")!
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(["Kurumsal adresiniz", "E-posta adresi geçersiz."]);
  });

  it("hata yokken aria-invalid yok", () => {
    render(<Field label="Ad">{(p) => <input {...p} />}</Field>);
    const input = screen.getByLabelText("Ad");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("Alert", () => {
  it("critical → role=alert; diğerleri → role=status; kapatma düğmesi etiketli", () => {
    const onDismiss = vi.fn();
    render(
      <>
        <Alert tone="critical">Sunucuya ulaşılamadı.</Alert>
        <Alert tone="success" onDismiss={onDismiss}>
          Kaydedildi.
        </Alert>
      </>
    );
    expect(screen.getByRole("alert").textContent).toContain("Sunucuya ulaşılamadı.");
    expect(screen.getByRole("status").className).toContain("success");
    fireEvent.click(screen.getByRole("button", { name: "Uyarıyı kapat" }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

interface Row {
  uid: string;
  name: string;
  score: number;
}
const columns = [
  { key: "name", header: "Hekim", cell: (r: Row) => r.name, rowHeader: true },
  { key: "score", header: "Puan", cell: (r: Row) => r.score, align: "end" as const },
];

describe("DataTable", () => {
  it("caption, th scope=col ve scope=row", () => {
    render(
      <DataTable
        caption="Sınav sonuçları"
        columns={columns}
        rows={[{ uid: "u1", name: "A", score: 80 }]}
        rowKey={(r) => r.uid}
      />
    );
    const table = screen.getByRole("table", { name: "Sınav sonuçları" });
    expect([...table.querySelectorAll("thead th")].map((th) => th.getAttribute("scope"))).toEqual(["col", "col"]);
    expect(screen.getByRole("rowheader", { name: "A" })).toBeTruthy();
  });

  it("yükleniyor: aria-busy ve satır yok; boş: boş durum; hata: uyarı ve satır yok", () => {
    const rows = [{ uid: "u1", name: "A", score: 80 }];
    const { rerender } = render(<DataTable caption="T" columns={columns} rows={rows} rowKey={(r) => r.uid} loading />);
    expect(screen.getByRole("table").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Yükleniyor…")).toBeTruthy();
    expect(screen.queryByText("A")).toBeNull();

    rerender(
      <DataTable
        caption="T"
        columns={columns}
        rows={[]}
        rowKey={(r) => r.uid}
        empty={<EmptyState title="Henüz sonuç yok" />}
      />
    );
    expect(screen.getByText("Henüz sonuç yok")).toBeTruthy();

    rerender(
      <DataTable caption="T" columns={columns} rows={rows} rowKey={(r) => r.uid} error="Sonuçlar yüklenemedi." />
    );
    expect(screen.getByRole("alert").textContent).toContain("Sonuçlar yüklenemedi.");
    expect(screen.queryByText("A")).toBeNull();
  });
});

function ToastButtons() {
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => toast.show("Davet oluşturuldu.", { tone: "success" })}>
        başarı
      </button>
      <button type="button" onClick={() => toast.show("Bağlantı koptu.", { tone: "critical" })}>
        hata
      </button>
    </>
  );
}

describe("Toast", () => {
  it("canlı bölgeler baştan var; başarı kendiliğinden kapanır, kritik kapanmaz ve kapatılabilir", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastButtons />
      </ToastProvider>
    );
    const polite = screen.getByRole("status");
    const urgent = screen.getByRole("alert");
    expect(polite.textContent).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "başarı" }));
    fireEvent.click(screen.getByRole("button", { name: "hata" }));
    expect(polite.textContent).toContain("Davet oluşturuldu.");
    expect(urgent.textContent).toContain("Bağlantı koptu.");

    act(() => vi.advanceTimersByTime(60_000));
    expect(polite.textContent).toBe("");
    expect(urgent.textContent).toContain("Bağlantı koptu.");

    fireEvent.click(screen.getByRole("button", { name: "Bildirimi kapat" }));
    expect(urgent.textContent).toBe("");
  });

  it("sağlayıcı dışında kullanım açık hata verir", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ToastButtons />)).toThrow(/ToastProvider/);
  });
});
