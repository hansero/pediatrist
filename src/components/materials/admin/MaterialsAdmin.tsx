"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { MaterialList } from "./MaterialList";
import { MaterialUploadForm } from "./MaterialUploadForm";

/** Admin materyal yönetimi (F6.2): bütün veri Firestore/Storage'dan, bütün işlemler callable'larla. */
export function MaterialsAdmin() {
  const [tab, setTab] = useState("list");
  return (
    <Tabs
      label="Materyal yönetimi bölümleri"
      value={tab}
      onChange={setTab}
      items={[
        { id: "list", label: "Materyaller", content: <MaterialList onUpload={() => setTab("upload")} /> },
        { id: "upload", label: "Yükle", content: <MaterialUploadForm onDone={() => setTab("list")} /> },
      ]}
    />
  );
}
