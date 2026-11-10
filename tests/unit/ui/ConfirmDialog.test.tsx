// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AppError } from "@/lib/errors";

afterEach(cleanup);

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Harness({ onConfirm }: { onConfirm: () => Promise<unknown> | unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <main>
      <button type="button" onClick={() => setOpen(true)}>
        Askıya al
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Üyeliği askıya al"
        description="Dr. Deneme'nin açık oturumları hemen kapanır."
        confirmLabel="Askıya al"
        pendingLabel="Askıya alınıyor…"
        onConfirm={onConfirm}
      />
    </main>
  );
}

function openDialog() {
  const trigger = screen.getByRole("button", { name: "Askıya al" });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

describe("ConfirmDialog", () => {
  it("açılınca: alertdialog, başlık/açıklama bağlı, odak 'Vazgeç'te, arka plan inert", () => {
    render(<Harness onConfirm={vi.fn()} />);
    openDialog();
    const dialog = screen.getByRole("alertdialog", { name: "Üyeliği askıya al" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(dialog.getAttribute("aria-describedby")!)?.textContent).toContain("Dr. Deneme");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Vazgeç" }));
    const main = document.querySelector("main")!;
    expect(main.closest("[inert]")).not.toBeNull();
  });

  it("odak tuzağı: Tab ve Shift+Tab diyalog içinde döner", () => {
    render(<Harness onConfirm={vi.fn()} />);
    openDialog();
    const dialog = screen.getByRole("alertdialog");
    const cancel = screen.getByRole("button", { name: "Vazgeç" });
    const confirm = screen.getAllByRole("button", { name: "Askıya al" }).find((b) => dialog.contains(b))!;

    confirm.focus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);
  });

  it("Esc kapatır; odak tetikleyiciye döner; inert kaldırılır", () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const trigger = openDialog();
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector("[inert]")).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("işlem sürerken Esc ve Vazgeç çalışmaz; başarıda kapanır (iyimser başarı yok)", async () => {
    const d = deferred();
    render(<Harness onConfirm={() => d.promise} />);
    openDialog();
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(screen.getAllByRole("button", { name: "Askıya al" }).find((b) => dialog.contains(b))!);

    const pending = await screen.findByRole("button", { name: "Askıya alınıyor…" });
    expect(pending.getAttribute("aria-busy")).toBe("true");
    expect((screen.getByRole("button", { name: "Vazgeç" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    await act(async () => d.resolve());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("hata: Türkçe mesaj diyalogda gösterilir, diyalog açık kalır, tekrar denenebilir", async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(new AppError("permission-denied", "Kendi yetkinizi değiştiremezsiniz."))
      .mockResolvedValueOnce(undefined);
    render(<Harness onConfirm={onConfirm} />);
    openDialog();
    const dialog = screen.getByRole("alertdialog");
    const confirm = () => screen.getAllByRole("button", { name: "Askıya al" }).find((b) => dialog.contains(b))!;

    fireEvent.click(confirm());
    expect((await screen.findByRole("alert")).textContent).toContain("Kendi yetkinizi değiştiremezsiniz.");
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    fireEvent.click(confirm());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
