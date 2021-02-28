export function timeDurationString(seconds: number, format: "short" | "long") {
  let t = Math.floor(seconds);
  const h = Math.floor(t / 3600);
  t = t - h * 3600;

  const m = Math.floor(t / 60);
  t = t - m * 60;

  const s = t;

  const [hSuffix, mSuffix, sSuffix] = {
    short: ["h", "m", "s"],
    long: [
      ` hour${h > 1 ? "s" : ""}`,
      ` minute${m > 1 ? "s" : ""}`,
      ` second${s > 1 ? "s" : ""}`
    ]
  }[format];
  const hString = h > 0 ? `${h}${hSuffix} ` : "";
  const mString = m > 0 ? `${m}${mSuffix} ` : "";
  const sString = h < 1 && m < 1 && s > 0 ? `${s}${sSuffix}` : "";
  return `${hString}${mString}${sString}`;
}

export function getMonthNames() {
  return [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
}
