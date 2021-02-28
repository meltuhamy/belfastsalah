export default function debounce<T extends Function>(cb: T, wait = 20) {
  let h: NodeJS.Timeout | null = null;
  let callable = (...args: any) => {
    h != null && clearTimeout(h);
    h = setTimeout(() => cb(...args), wait);
  };
  return (callable as any) as T;
}
