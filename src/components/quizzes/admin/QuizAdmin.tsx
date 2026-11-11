"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { QuizArchive } from "./QuizArchive";
import { QuizImport } from "./QuizImport";
import { QuizList } from "./QuizList";
import { QuizMediaManager } from "./QuizMediaManager";

/**
 * Admin sınav stüdyosu (F5.2). Bütün veriler Firestore/Storage'dan gelir; bütün işlemler callable'larla ve
 * sonuç beklenerek yapılır. Hekim analitiği ve karne incelemesi F5.4'te eklenir.
 */
export function QuizAdmin() {
  const [tab, setTab] = useState("list");
  return (
    <Tabs
      label="Sınav yönetimi bölümleri"
      value={tab}
      onChange={setTab}
      items={[
        { id: "list", label: "Sınavlar", content: <QuizList onCreate={() => setTab("new")} /> },
        { id: "new", label: "Yeni sınav", content: <QuizImport onSaved={() => setTab("list")} /> },
        { id: "media", label: "Görseller", content: <QuizMediaManager /> },
        { id: "archive", label: "Arşiv", content: <QuizArchive /> },
      ]}
    />
  );
}
