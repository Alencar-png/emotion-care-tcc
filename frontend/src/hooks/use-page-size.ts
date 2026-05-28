"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY_PREFIX = "emotioncare_page_size_";
const DEFAULT_PAGE_SIZE = 10;
const ALLOWED_PAGE_SIZES = [10, 50, 100] as const;

export type PageSizeOption = (typeof ALLOWED_PAGE_SIZES)[number];

/**
 * Hook que gerencia o tamanho de pagina com persistencia em sessionStorage.
 * @param storageKey identificador unico por pagina (ex: "employees", "campaigns")
 */
export function usePageSize(storageKey: string) {
  const fullKey = STORAGE_KEY_PREFIX + storageKey;

  const [pageSize, setPageSizeState] = useState<PageSizeOption>(() => {
    if (typeof window === "undefined") return DEFAULT_PAGE_SIZE;
    try {
      const stored = sessionStorage.getItem(fullKey);
      if (stored) {
        const parsed = Number(stored);
        if (ALLOWED_PAGE_SIZES.includes(parsed as PageSizeOption)) {
          return parsed as PageSizeOption;
        }
      }
    } catch {
      // sessionStorage indisponivel
    }
    return DEFAULT_PAGE_SIZE;
  });

  const setPageSize = useCallback(
    (size: number) => {
      const validSize = ALLOWED_PAGE_SIZES.includes(size as PageSizeOption)
        ? (size as PageSizeOption)
        : DEFAULT_PAGE_SIZE;
      setPageSizeState(validSize);
      try {
        sessionStorage.setItem(fullKey, String(validSize));
      } catch {
        // sessionStorage indisponivel
      }
    },
    [fullKey]
  );

  return { pageSize, setPageSize, pageSizeOptions: ALLOWED_PAGE_SIZES };
}
