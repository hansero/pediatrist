"use client";

import { useCallback, useEffect, useState } from "react";
import { toUserMessage } from "@/lib/errors";
import { listQuizMedia } from "./media";

/**
 * Yüklü sınav görselleri (`quiz_media/`): Görseller sekmesi ve önizlemedeki görsel seçici (F14) ortak kullanır.
 * Liste bileşen açılınca bir kez okunur; yüklemeden sonra `add` ile yerel olarak güncellenir.
 */
export function useQuizMediaLibrary() {
  const [paths, setPaths] = useState<string[] | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setError("");
      setPaths(await listQuizMedia());
    } catch (err) {
      setError(toUserMessage(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback((path: string) => {
    setPaths((list) =>
      list && !list.includes(path) ? [...list, path].sort((a, b) => a.localeCompare(b, "tr")) : list
    );
  }, []);

  return { paths, error, loading: paths === null && !error, refresh, add };
}
