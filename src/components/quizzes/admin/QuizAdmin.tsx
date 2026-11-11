"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { DoctorProgress } from "./DoctorProgress";
import { QuizArchive } from "./QuizArchive";
import { QuizImport } from "./QuizImport";
import { QuizList } from "./QuizList";
import { QuizMediaManager } from "./QuizMediaManager";
import { QuizResults } from "./QuizResults";

/**
 * Admin sınav stüdyosu (F5.2). Bütün veriler Firestore/Storage'dan gelir; bütün işlemler callable'larla ve
 * sonuç beklenerek yapılır. Sonuçlar ve hekim gelişimi F5.4.
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
        { id: "results", label: "Sonuçlar", content: <QuizResults /> },
        { id: "doctors", label: "Hekimler", content: <DoctorProgress /> },
        { id: "media", label: "Görseller", content: <QuizMediaManager /> },
        { id: "archive", label: "Arşiv", content: <QuizArchive /> },
      ]}
    />
  );
}
