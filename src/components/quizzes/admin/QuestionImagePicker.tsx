"use client";

import { useId, useMemo, useState } from "react";
import { QUIZ_MEDIA_UPLOAD } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import { toUserMessage } from "@/lib/errors";
import { quizMediaProblem, uniqueQuizMediaPath, uploadQuizMediaUnique } from "@/lib/quiz/media";
import { useQuizMediaLibrary } from "@/lib/quiz/useQuizMediaLibrary";
import { QuizImage } from "../QuestionPreview";

const PAGE = 24;

/**
 * Önizlemede soruya görsel ekleme (F14, D29): bilgisayardan yükle ya da yüklü görsellerden seç.
 * Yüklenen görsel soruya ANCAK Storage yüklemesi bitince bağlanır (D12). Ad otomatik ve benzersizdir; var olan
 * görselin üzerine yazılmaz (Storage kuralı da yasaklar). Yükleme sürerken diyalog kapatılamaz.
 */
export function QuestionImagePicker({
  questionNumber,
  currentPath,
  onChoose,
  onClose,
}: {
  questionNumber: number;
  currentPath: string;
  onChoose: (path: string, how: "uploaded" | "picked") => void;
  onClose: () => void;
}) {
  const library = useQuizMediaLibrary();
  const [tab, setTab] = useState("upload");
  const [uploading, setUploading] = useState(false);

  return (
    <Dialog
      open
      onClose={() => !uploading && onClose()}
      title={`Soru ${questionNumber} görseli`}
      description="Yeni görsel yükleyin ya da daha önce yüklenmiş bir görseli seçin."
      dismissible={!uploading}
    >
      <Tabs
        label="Görsel kaynağı"
        value={tab}
        onChange={(id) => !uploading && setTab(id)}
        items={[
          {
            id: "upload",
            label: "Bilgisayardan yükle",
            content: (
              <UploadPane
                library={library}
                busy={uploading}
                setBusy={setUploading}
                onDone={(path) => onChoose(path, "uploaded")}
                onCancel={onClose}
              />
            ),
          },
          {
            id: "pick",
            label: "Yüklü görsellerden seç",
            disabled: uploading,
            content: (
              <PickPane
                library={library}
                currentPath={currentPath}
                onPick={(path) => onChoose(path, "picked")}
                onCancel={onClose}
              />
            ),
          },
        ]}
      />
    </Dialog>
  );
}

type Library = ReturnType<typeof useQuizMediaLibrary>;

function UploadPane({
  library,
  busy,
  setBusy,
  onDone,
  onCancel,
}: {
  library: Library;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onDone: (path: string) => void;
  onCancel: () => void;
}) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  const taken = useMemo(() => new Set(library.paths ?? []), [library.paths]);
  const plannedPath = file && !problem && library.paths ? uniqueQuizMediaPath(file.name, file.type, taken) : "";

  function pick(f: File | null) {
    setError("");
    setProgress(0);
    setFile(f);
    setProblem(f ? (quizMediaProblem(f) ?? "") : "");
  }

  async function upload() {
    if (!file || problem || !library.paths) return;
    setBusy(true);
    setError("");
    try {
      const path = await uploadQuizMediaUnique(file, taken, setProgress);
      library.add(path);
      onDone(path);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-stack">
      {library.error && (
        <Alert tone="critical" title="Yüklü görseller okunamadı">
          {library.error} Ad çakışması denetlenemediği için yükleme yapılamaz.{" "}
          <Button size="sm" variant="secondary" onClick={() => void library.refresh()}>
            Tekrar dene
          </Button>
        </Alert>
      )}
      <div className="form-group">
        <label htmlFor={inputId} className="form-label">
          Görsel dosyası
        </label>
        <input
          id={inputId}
          type="file"
          accept={QUIZ_MEDIA_UPLOAD.contentTypes.join(",")}
          className="form-input"
          disabled={busy}
          aria-describedby={`${inputId}-hint`}
          aria-invalid={problem ? true : undefined}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <p id={`${inputId}-hint`} className="ui-field-hint">
          PNG, JPEG, WebP veya GIF; en fazla {QUIZ_MEDIA_UPLOAD.maxMb} MB. Aynı adlı görsel varsa yeni ad verilir.
        </p>
        {problem && <p className="ui-field-error">{problem}</p>}
      </div>
      {library.loading && <p className="page-header-subtitle">Yüklü görseller denetleniyor…</p>}
      {plannedPath && (
        <p className="page-header-subtitle">
          Kaydedilecek ad: <code>{plannedPath}</code>
        </p>
      )}
      {busy && <progress max={1} value={progress} aria-label="Görsel yükleniyor" />}
      {error && <Alert tone="critical">{error}</Alert>}
      <div className="ui-dialog-actions">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Vazgeç
        </Button>
        <Button
          onClick={() => void upload()}
          loading={busy}
          loadingText="Yükleniyor…"
          disabled={!file || Boolean(problem) || !library.paths}
        >
          Yükle ve ekle
        </Button>
      </div>
    </div>
  );
}

function PickPane({
  library,
  currentPath,
  onPick,
  onCancel,
}: {
  library: Library;
  currentPath: string;
  onPick: (path: string) => void;
  onCancel: () => void;
}) {
  const filterId = useId();
  const groupName = useId();
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const [selected, setSelected] = useState(currentPath);

  const q = query.trim().toLocaleLowerCase("tr");
  const matches = (library.paths ?? []).filter((p) => !q || p.toLocaleLowerCase("tr").includes(q));

  if (library.error) {
    return (
      <Alert tone="critical" title="Yüklü görseller okunamadı">
        {library.error}{" "}
        <Button size="sm" variant="secondary" onClick={() => void library.refresh()}>
          Tekrar dene
        </Button>
      </Alert>
    );
  }
  if (library.loading) return <p className="page-header-subtitle">Görseller yükleniyor…</p>;
  if (!library.paths?.length) {
    return <EmptyState title="Henüz görsel yok" description="'Bilgisayardan yükle' sekmesini kullanın." />;
  }

  return (
    <div className="auth-stack">
      <div className="form-group">
        <label htmlFor={filterId} className="form-label">
          Ada göre süz
        </label>
        <input
          id={filterId}
          type="search"
          className="form-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(PAGE);
          }}
        />
      </div>
      <fieldset className="ui-fieldset">
        <legend className="form-label">
          Görseller ({matches.length}
          {q ? ` / ${library.paths.length}` : ""})
        </legend>
        {matches.length === 0 ? (
          <p className="page-header-subtitle">Bu adla görsel yok.</p>
        ) : (
          <div className="media-pick-grid">
            {matches.slice(0, visible).map((path) => (
              <label key={path} className="media-pick-item">
                <span className="media-pick-choice">
                  <input
                    type="radio"
                    name={groupName}
                    value={path}
                    checked={selected === path}
                    onChange={() => setSelected(path)}
                  />
                  <code>{path.replace(/^quiz_media\//, "")}</code>
                </span>
                {/* Ad metniyle etiketli; küçük resim süs (alt=""). */}
                <QuizImage path={path} alt="" className="quiz-thumb" />
              </label>
            ))}
          </div>
        )}
      </fieldset>
      {visible < matches.length && (
        <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE)}>
          {Math.min(PAGE, matches.length - visible)} görsel daha göster
        </Button>
      )}
      <div className="ui-dialog-actions">
        <Button variant="secondary" onClick={onCancel}>
          Vazgeç
        </Button>
        <Button onClick={() => onPick(selected)} disabled={!selected || selected === currentPath}>
          Seçili görseli ekle
        </Button>
      </div>
    </div>
  );
}
