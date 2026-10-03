// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export default function debounce<T extends Function>(cb: T, wait = 20) {
  let h: ReturnType<typeof setTimeout> | null = null;
  let callable = (...args: any) => {
    if (h != null) {
      clearTimeout(h);
    }
    h = setTimeout(() => cb(...args), wait);
  };
  return (callable as any) as T;
}
