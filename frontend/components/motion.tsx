"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Число, которое плавно «докручивается» до нового значения */
export function ScoreNumber({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value || reduced()) {
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / 500);
      setShown(Math.round(start + (value - start) * (1 - Math.pow(1 - t, 4))));
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={className}>{shown}</span>;
}

/** Плашка уровня вспыхивает, когда уровень меняется */
export function useFlashOnChange<T>(value: T) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value && ref.current && !reduced()) {
      const el = ref.current.querySelector(".tier") ?? ref.current;
      el.classList.remove("is-flash");
      void (el as HTMLElement).offsetWidth;
      el.classList.add("is-flash");
    }
    prev.current = value;
  }, [value]);
  return ref;
}

/** FLIP: строки списка плавно переезжают на новые места */
export function useFlip<T extends HTMLElement>(deps: unknown) {
  const listRef = useRef<T>(null);
  const positions = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.children) as HTMLElement[];
    if (!reduced()) {
      for (const el of items) {
        const id = el.dataset.id;
        const before = id ? positions.current.get(id) : undefined;
        if (before === undefined) continue;
        const dy = before - el.offsetTop;
        if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
      }
    }
    positions.current = new Map(items.map((el) => [el.dataset.id ?? "", el.offsetTop]));
  }, [deps]);

  return listRef;
}
