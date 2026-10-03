/**
 * What the preview comment shows, in order. Each file is a capture name -
 * PreviewCapture.swift and PreviewCapture.kt write `<name>.png` - under the
 * platform's folder.
 *
 * A file listed here and not captured is called out in the comment, unless
 * it is optional: the later home screen pages only exist when the launcher
 * ran out of room on the first.
 */
export const CATALOGUE = [
  {
    title: "iOS: app",
    dir: "ios",
    images: [
      { file: "app-setup", caption: "Setup" },
      { file: "app-today-light", caption: "Today" },
      { file: "app-month-light", caption: "Month" },
      { file: "app-settings-light", caption: "Settings" },
      { file: "app-today-dark", caption: "Today, dark" },
      { file: "app-settings-dark", caption: "Settings, dark" },
    ],
  },
  {
    title: "Android: app",
    dir: "android",
    images: [
      { file: "app-setup", caption: "Setup" },
      { file: "app-today-light", caption: "Today" },
      { file: "app-month-light", caption: "Month" },
      { file: "app-settings-light", caption: "Settings" },
      { file: "app-today-dark", caption: "Today, dark" },
      { file: "app-settings-dark", caption: "Settings, dark" },
    ],
  },
  {
    title: "Android: home screen widgets",
    dir: "android",
    images: [
      { file: "widget-tile", caption: "Next prayer tile" },
      { file: "widget-compact", caption: "One row" },
      { file: "widget-column", caption: "One column" },
      { file: "widget-wide", caption: "Wide" },
      { file: "widget-tall", caption: "Tall" },
      { file: "home-screen-1", caption: "Home screen" },
      { file: "home-screen-2", caption: "Home screen, page 2", optional: true },
      { file: "home-screen-3", caption: "Home screen, page 3", optional: true },
    ],
  },
  {
    title: "Android: widget settings",
    dir: "android",
    images: [{ file: "widget-settings", caption: "Appearance" }],
  },
];
