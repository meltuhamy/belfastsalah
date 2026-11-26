import { RefObject, useLayoutEffect, useState } from "react";

/**
 * A yes/no question about how an element is laid out - "do six times still
 * fit across?" - asked again whenever it or anything inside it changes size.
 *
 * For the layouts that cannot just grow with the system text size (MEL-105):
 * they measure whether their content fits rather than switching at some
 * text scale, so the answer is right for a narrow phone, a 12-hour clock and
 * a long place name alike. `measure` must not depend on the answer it gives -
 * measure content widths, which do not change with the layout chosen - or
 * the layout would flip back and forth.
 *
 * `deps` are anything that changes what there is to measure without
 * resizing the element itself, such as the element appearing at all.
 */
export function useMeasured<T extends HTMLElement>(
  ref: RefObject<T | null>,
  measure: (element: T) => boolean,
  deps: ReadonlyArray<unknown> = []
): boolean {
  const [answer, setAnswer] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element == null) return;
    const update = () => setAnswer(measure(element));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.querySelectorAll("*").forEach((child) => observer.observe(child));
    return () => observer.disconnect();
    // `measure` is a fresh closure every render; what it reads is in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return answer;
}
