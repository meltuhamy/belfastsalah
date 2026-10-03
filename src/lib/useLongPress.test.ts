import { renderHook, act } from "@testing-library/react";
import { useLongPress } from "./useLongPress";

describe("useLongPress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Should fire once the press is held long enough", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, 500));

    act(() => result.current.onPointerDown());
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("Should not fire for a short tap", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, 500));

    act(() => result.current.onPointerDown());
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => result.current.onPointerUp());
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("Should not fire if the pointer leaves before the delay", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, 500));

    act(() => result.current.onPointerDown());
    act(() => result.current.onPointerLeave());
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("Should call the latest callback, not the one bound on mount", () => {
    // The settings screen re-renders every second off the app ticker, so a
    // handler captured at bind time would go stale.
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useLongPress(cb, 500),
      { initialProps: { cb: first } }
    );

    rerender({ cb: second });

    act(() => result.current.onPointerDown());
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
