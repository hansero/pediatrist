"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  /** Sekme listesinin erişilebilir adı. */
  label: string;
  items: TabItem[];
  /** Kontrollü kullanım. */
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** Gizli panellerin içeriğini DOM'da tut (form durumu korunur). Varsayılan: yalnızca seçili panel. */
  keepMounted?: boolean;
  className?: string;
}

/**
 * WAI-ARIA sekme deseni (otomatik etkinleştirme):
 * ← / → önceki/sonraki (döngüsel), Home / End ilk/son; devre dışı sekmeler atlanır.
 * Yalnızca seçili sekme Tab sırasındadır (roving tabindex); panel odaklanabilir.
 */
export function Tabs({ label, items, value, defaultValue, onChange, keepMounted = false, className }: TabsProps) {
  const baseId = useId();
  const firstEnabled = items.find((i) => !i.disabled)?.id ?? "";
  const [internal, setInternal] = useState(defaultValue ?? firstEnabled);
  const selected = value ?? internal;
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  function select(id: string) {
    if (value === undefined) setInternal(id);
    onChange?.(id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const enabled = items.map((item, i) => ({ item, i })).filter(({ item }) => !item.disabled);
    const pos = enabled.findIndex(({ i }) => i === index);
    let target: TabItem | undefined;
    switch (event.key) {
      case "ArrowRight":
        target = enabled[(pos + 1) % enabled.length]?.item;
        break;
      case "ArrowLeft":
        target = enabled[(pos - 1 + enabled.length) % enabled.length]?.item;
        break;
      case "Home":
        target = enabled[0]?.item;
        break;
      case "End":
        target = enabled[enabled.length - 1]?.item;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (!target) return;
    select(target.id);
    tabRefs.current.get(target.id)?.focus();
  }

  return (
    <div className={cx("ui-tabs", className)}>
      <div role="tablist" aria-label={label} className="mode-switcher">
        {items.map((item, index) => {
          const isSelected = item.id === selected;
          return (
            <button
              key={item.id}
              ref={(el) => {
                if (el) tabRefs.current.set(item.id, el);
                else tabRefs.current.delete(item.id);
              }}
              type="button"
              role="tab"
              id={tabId(item.id)}
              aria-selected={isSelected}
              aria-controls={panelId(item.id)}
              tabIndex={isSelected ? 0 : -1}
              disabled={item.disabled}
              className={cx("mode-btn", isSelected && "active")}
              onClick={() => select(item.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => {
        const isSelected = item.id === selected;
        return (
          <div
            key={item.id}
            role="tabpanel"
            id={panelId(item.id)}
            aria-labelledby={tabId(item.id)}
            hidden={!isSelected}
            tabIndex={0}
            className="ui-tabpanel"
          >
            {(isSelected || keepMounted) && item.content}
          </div>
        );
      })}
    </div>
  );
}
