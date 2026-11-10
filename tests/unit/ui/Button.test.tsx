// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("varsayılan type=button (form içinde istemeden gönderim yok) ve tıklanır", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Kaydet</Button>);
    const button = screen.getByRole("button", { name: "Kaydet" });
    expect(button.getAttribute("type")).toBe("button");
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("N3: sunucu çıktısında (hydration öncesi) devre dışı", () => {
    const html = renderToString(<Button type="submit">Gönder</Button>);
    expect(html).toMatch(/disabled=""/);
    expect(html).toContain('data-hydrated="false"');
  });

  it("yüklenirken: aria-busy + aria-disabled, odaklanabilir kalır, tıklama ve form gönderimi engellenir", () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading loadingText="Kaydediliyor…" onClick={onClick}>
          Kaydet
        </Button>
      </form>
    );
    const button = screen.getByRole("button", { name: "Kaydediliyor…" }) as HTMLButtonElement;
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.disabled).toBe(false);
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disabled prop'u gerçekten devre dışı bırakır; varyant sınıfları uygulanır", () => {
    render(
      <Button variant="danger" size="sm" disabled>
        Sil
      </Button>
    );
    const button = screen.getByRole("button", { name: "Sil" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.className).toBe("btn btn-danger btn-sm");
  });
});
