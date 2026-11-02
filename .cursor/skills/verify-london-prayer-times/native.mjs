#!/usr/bin/env node
/**
 * Build, install, and drive the Capacitor iOS or Android app.
 *
 *   node .cursor/skills/verify-london-prayer-times/native.mjs launch ios
 *   node .cursor/skills/verify-london-prayer-times/native.mjs doctor ios
 *   node .cursor/skills/verify-london-prayer-times/native.mjs pass ios
 *   node .cursor/skills/verify-london-prayer-times/native.mjs cleanup ios
 *
 * Android uses the same four commands with `android`. Launch refuses to
 * install JDK or SDK packages. On a machine that does not already have them
 * it prints the gap and exits 1.
 *
 * Web checks stay in drive.mjs. This file does not start Vite.
 */

import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRAYER_NAMES,
  UK_TIME_ZONE,
  belfastTimes,
  londonNow,
  londonTimes,
  zonesAgree,
} from "./timetable.mjs";

const skillDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(skillDir, "..", "..", "..");
const evidenceDir = process.env.VERIFY_EVIDENCE_DIR ?? join(skillDir, "evidence");
const toolsDir = join(skillDir, ".tools");
const buildDir = join(skillDir, ".build");
const sessionPath = join(buildDir, "session.json");
const APP_ID = "com.meltuhamy.londonsalah";
const DEVELOPER_DIR = "/Applications/Xcode.app/Contents/Developer";
const XCODEBUILD = join(DEVELOPER_DIR, "usr", "bin", "xcodebuild");
const SIMCTL = join(DEVELOPER_DIR, "usr", "bin", "simctl");
const MAESTRO_VERSION = "2.12.0";

const command = process.argv[2];
const platform = process.argv[3];
if (
  !["launch", "doctor", "pass", "cleanup"].includes(command) ||
  !["ios", "android"].includes(platform)
) {
  console.error("usage: native.mjs launch|doctor|pass|cleanup ios|android");
  process.exit(2);
}

function sleep(ms) {
  spawnSync("sleep", [String(ms / 1000)]);
}

function maestroEnv() {
  const javaHome = resolveJavaHome();
  return {
    ...process.env,
    JAVA_HOME: javaHome,
    PATH: `${join(javaHome, "bin")}:${process.env.PATH}`,
    MAESTRO_CLI_NO_ANALYTICS: "1",
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: "true",
    MAESTRO_DRIVER_STARTUP_TIMEOUT: "180000",
  };
}

function resolveJavaHome() {
  const candidates = [
    join(toolsDir, "jre", "Contents", "Home"),
    join(toolsDir, "jre"),
  ];
  for (const home of candidates) {
    if (existsSync(join(home, "bin", "java"))) {
      return home;
    }
  }
  return null;
}

function maestroBin() {
  return join(toolsDir, "maestro", "bin", "maestro");
}

function ensureTools() {
  mkdirSync(toolsDir, { recursive: true });
  if (!existsSync(maestroBin())) {
    const zip = join(toolsDir, "maestro.zip");
    console.log(`Downloading Maestro ${MAESTRO_VERSION} into ${toolsDir}`);
    const curl = spawnSync(
      "curl",
      [
        "--fail",
        "--location",
        "-o",
        zip,
        `https://github.com/mobile-dev-inc/maestro/releases/download/cli-${MAESTRO_VERSION}/maestro.zip`,
      ],
      { stdio: "inherit" }
    );
    if (curl.status !== 0) {
      throw new Error("Could not download Maestro. The native driver needs it.");
    }
    const unzip = spawnSync("unzip", ["-qo", zip, "-d", toolsDir], { stdio: "inherit" });
    if (unzip.status !== 0) {
      throw new Error("Could not unzip Maestro.");
    }
  }
  if (!resolveJavaHome()) {
    const arch = process.arch === "arm64" ? "aarch64" : "x64";
    const os = process.platform === "darwin" ? "mac" : "linux";
    const tar = join(toolsDir, "temurin-jre21.tar.gz");
    const url =
      `https://api.adoptium.net/v3/binary/latest/21/ga/${os}/${arch}/jre/hotspot/normal/eclipse?project=jdk`;
    console.log(`Downloading a Temurin 21 JRE into ${toolsDir} (Maestro 2 requires Java 17+).`);
    const curl = spawnSync("curl", ["--fail", "--location", "-o", tar, url], {
      stdio: "inherit",
    });
    if (curl.status !== 0) {
      throw new Error("Could not download a Java 21 runtime for Maestro.");
    }
    mkdirSync(join(toolsDir, "jre"), { recursive: true });
    const extract = spawnSync(
      "tar",
      ["-xzf", tar, "-C", join(toolsDir, "jre"), "--strip-components=1"],
      { stdio: "inherit" }
    );
    if (extract.status !== 0 || !resolveJavaHome()) {
      throw new Error("The Temurin archive did not contain a java binary.");
    }
  }
  const version = spawnSync(maestroBin(), ["--version"], {
    env: maestroEnv(),
    encoding: "utf8",
  });
  if (version.status !== 0) {
    throw new Error(`maestro --version failed:\n${version.stdout}\n${version.stderr}`);
  }
  console.log(`Maestro ${version.stdout.trim().split("\n").pop()}`);
}

function requireNode24() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major !== 24) {
    throw new Error(
      `Node ${process.versions.node} is running. .nvmrc requires 24. Run: . "$HOME/.nvm/nvm.sh" && nvm use`
    );
  }
}

function run(cmd, args, { cwd = repoRoot, env = process.env, log } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env });
    const chunks = [];
    const take = (buf) => {
      chunks.push(buf);
      process.stdout.write(buf);
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    child.on("error", reject);
    child.on("close", (code) => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (log) {
        mkdirSync(dirname(log), { recursive: true });
        writeFileSync(log, text);
      }
      if (code === 0) {
        resolve(text);
      } else {
        reject(new Error(`${cmd} exited ${code}`));
      }
    });
  });
}

function readSession() {
  if (!existsSync(sessionPath)) {
    throw new Error(
      `No session at ${sessionPath}. Run launch ${platform} first, and do not drive a simulator this run did not boot.`
    );
  }
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  if (session.platform !== platform) {
    throw new Error(
      `Session is ${session.platform}, command asked for ${platform}. Cleanup the other one first.`
    );
  }
  return session;
}

function writeSession(session) {
  mkdirSync(buildDir, { recursive: true });
  writeFileSync(sessionPath, `${JSON.stringify(session, null, 2)}\n`);
}

function simctl(args, { allowFail = false } = {}) {
  const result = spawnSync(SIMCTL, args, {
    encoding: "utf8",
    env: { ...process.env, DEVELOPER_DIR },
  });
  if (result.status !== 0 && !allowFail) {
    throw new Error(
      `simctl ${args.join(" ")} exited ${result.status}\n${result.stdout}\n${result.stderr}`
    );
  }
  return result;
}

// The first boot after xcodebuild often hits SimLaunchHost before it is
// listening (simctl exit 53, "Connection invalid"). A second boot works.
function bootSimulator(udid) {
  const attempts = 4;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = simctl(["boot", udid], { allowFail: true });
    if (result.status === 0) return;
    const text = `${result.stdout || ""}\n${result.stderr || ""}`;
    const transient =
      result.status === 53 ||
      /Connection invalid|Software caused connection abort|XPC error/i.test(text);
    if (!transient || attempt === attempts) {
      throw new Error(`simctl boot ${udid} exited ${result.status}\n${text}`);
    }
    console.log(
      `simctl boot exited ${result.status} (SimLaunchHost not ready). Retry ${attempt} of ${attempts - 1}.`
    );
    sleep(2000);
  }
}

function pickIphone() {
  const listed = simctl(["list", "devices", "available", "-j"]);
  const parsed = JSON.parse(listed.stdout);
  const booted = [];
  const candidates = [];
  for (const [runtime, devices] of Object.entries(parsed.devices)) {
    const version = runtime.match(/iOS-(\d+)-(\d+)/);
    const runtimeLabel = version ? `iOS ${version[1]}.${version[2]}` : runtime;
    const rank = version ? Number(version[1]) * 100 + Number(version[2]) : 0;
    for (const device of devices) {
      if (!device.isAvailable) continue;
      if (device.state === "Booted") {
        booted.push(`${device.name} (${runtimeLabel})`);
      }
      if (device.name === "iPhone 16" || device.name === "iPhone 17") {
        candidates.push({ ...device, runtimeLabel, rank, preferred: device.name === "iPhone 16" });
      }
    }
  }
  if (booted.length > 0) {
    throw new Error(
      `A simulator is already booted: ${booted.join(", ")}. Refusing to drive it. Shut it down if it is leftover from another run, then launch again.`
    );
  }
  candidates.sort((a, b) => Number(b.preferred) - Number(a.preferred) || b.rank - a.rank);
  if (candidates.length === 0) {
    throw new Error("No available iPhone 16 or iPhone 17 simulator. xcrun simctl list devices available");
  }
  return candidates[0];
}

function screenshot(session, name) {
  mkdirSync(evidenceDir, { recursive: true });
  const dest = join(evidenceDir, `${session.platform}-${name}.png`);
  if (session.platform === "ios") {
    simctl(["io", session.udid, "screenshot", dest]);
  } else {
    const adb = join(session.androidHome, "platform-tools", "adb");
    const shot = spawnSync(adb, ["exec-out", "screencap", "-p"], {
      maxBuffer: 20 * 1024 * 1024,
    });
    if (shot.status !== 0) {
      throw new Error(`adb screencap exited ${shot.status}`);
    }
    writeFileSync(dest, shot.stdout);
  }
  console.log(`screenshot ${dest}`);
  return dest;
}

function writeFlow(name, steps) {
  const path = join(evidenceDir, "flows", `${name}.yaml`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `appId: ${APP_ID}\n---\n${steps.trim()}\n`);
  return path;
}

function maestroTest(flowFile) {
  const args = ["test"];
  if (existsSync(sessionPath)) {
    try {
      const session = JSON.parse(readFileSync(sessionPath, "utf8"));
      if (session.udid) {
        args.push("--udid", session.udid);
      }
    } catch {
      // A corrupt session is reported by readSession. Driving still needs a device.
    }
  }
  args.push(flowFile);
  const result = spawnSync(maestroBin(), args, {
    env: maestroEnv(),
    encoding: "utf8",
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  process.stdout.write(output);
  if (result.status !== 0) {
    const tail = output.slice(-2500);
    throw new Error(`maestro test ${flowFile} exited ${result.status}\n${tail}`);
  }
}

function below(time, name) {
  return `- assertVisible:\n    text: "${time}"\n    below: "${name}"`;
}

// Maestro matches the whole accessibility string. On iOS an ion-select's
// value is only the row label ("Location, London"). Android often exposes
// the value as its own text node ("London"). Either one is that row.
function rowValue(label, value) {
  return `^(${value}|${label}, ${value})$`;
}

function stripAsserts(times) {
  return PRAYER_NAMES.map((name) => below(times[name], name)).join("\n");
}

async function launchIos() {
  requireNode24();
  if (!existsSync(XCODEBUILD) || !existsSync(SIMCTL)) {
    throw new Error(
      "Xcode's xcodebuild or simctl is missing. This skill does not install Xcode."
    );
  }
  ensureTools();
  const device = pickIphone();
  console.log(`Using ${device.name} (${device.runtimeLabel}) ${device.udid}`);

  const npm = join(dirname(process.execPath), "npm");
  const npx = join(dirname(process.execPath), "npx");
  await run(npm, ["run", "build"], { log: join(evidenceDir, "ios-web-build.log") });
  await run(npx, ["cap", "sync", "ios"], { log: join(evidenceDir, "ios-cap-sync.log") });

  const derived = join(buildDir, "ios-derived");
  mkdirSync(derived, { recursive: true });
  const xcodeArgs = [
    "-project",
    "ios/App/App.xcodeproj",
    "-scheme",
    "App",
    "-configuration",
    "Debug",
    "-destination",
    `platform=iOS Simulator,id=${device.udid}`,
    "-derivedDataPath",
    derived,
    "build",
  ];
  const xcodeEnv = { ...process.env, DEVELOPER_DIR };
  const xcodeLog = join(evidenceDir, "ios-xcodebuild.log");
  try {
    await run(XCODEBUILD, xcodeArgs, {
      env: xcodeEnv,
      log: xcodeLog,
    });
  } catch (error) {
    const log = existsSync(xcodeLog) ? readFileSync(xcodeLog, "utf8") : "";
    if (log.includes("have not agreed to the Xcode license")) {
      throw new Error(
        "xcodebuild exited 69. This Xcode's license is not accepted (the system record is for an older Xcode). An administrator has to run `sudo xcodebuild -license`. This skill does not type that password. Retrying the build with different signing flags does not get past it."
      );
    }
    console.log("Debug build failed. Retrying with simulator ad-hoc signing disabled.");
    await run(
      XCODEBUILD,
      xcodeArgs.concat([
        "CODE_SIGNING_ALLOWED=NO",
        "CODE_SIGNING_REQUIRED=NO",
        "CODE_SIGN_IDENTITY=",
      ]),
      { env: xcodeEnv, log: join(evidenceDir, "ios-xcodebuild.log") }
    );
  }

  const found = spawnSync(
    "find",
    [derived, "-type", "d", "-name", "App.app", "-path", "*Debug-iphonesimulator*"],
    { encoding: "utf8" }
  );
  const app = (found.stdout || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => !line.includes("Index.noindex"));
  if (!app) {
    throw new Error("xcodebuild finished but Debug-iphonesimulator/App.app was not found.");
  }

  bootSimulator(device.udid);
  simctl(["bootstatus", device.udid, "-b"]);
  simctl(["install", device.udid, app]);
  const session = {
    platform: "ios",
    udid: device.udid,
    name: device.name,
    runtime: device.runtimeLabel,
    bootedByUs: true,
    app,
  };
  writeSession(session);
  console.log(JSON.stringify({ ok: true, ...session }));
}

function androidPreflight() {
  const lines = [];
  const missing = [];
  const darwin = process.platform === "darwin";
  lines.push(`uname: ${process.platform} ${process.arch}`);
  if (darwin) {
    const hv = spawnSync("sysctl", ["-n", "kern.hv_support"], { encoding: "utf8" });
    lines.push(
      `Hypervisor.framework kern.hv_support=${(hv.stdout || "").trim() || "unknown"} (this is not KVM; KVM is a Linux device).`
    );
  } else if (process.platform === "linux") {
    const kvm = existsSync("/dev/kvm");
    lines.push(`/dev/kvm: ${kvm ? "present" : "MISSING"}`);
    if (!kvm) {
      missing.push(
        "/dev/kvm is missing. The Android emulator on Linux needs KVM. Enable nested virtualization on the VM and confirm `ls -l /dev/kvm` is readable and writable by this user. Do not install kernel modules from this skill."
      );
    } else {
      try {
        readFileSync("/dev/kvm");
      } catch (error) {
        if (error.code === "EACCES") {
          missing.push("/dev/kvm exists but this user cannot read it.");
        }
      }
    }
  } else {
    missing.push(`Unsupported OS ${process.platform} for the Android emulator.`);
  }

  const javaHomes = spawnSync("/usr/libexec/java_home", ["-V"], { encoding: "utf8" });
  const javaList = `${javaHomes.stdout || ""}${javaHomes.stderr || ""}`.trim();
  if (javaList) {
    lines.push("Installed JDKs (`/usr/libexec/java_home -V`):");
    lines.push(javaList);
  }
  const javac = spawnSync("javac", ["-version"], { encoding: "utf8" });
  const javacText = `${javac.stdout || ""}${javac.stderr || ""}`.trim();
  lines.push(`javac: ${javacText || "not on PATH"}`);
  const javacMajor = Number((javacText.match(/javac (\d+)/) || [])[1] || 0);
  if (javacMajor < 21) {
    missing.push(
      "Android builds need JDK 21 (android/app/build.gradle sets JavaVersion.VERSION_21 and jvmTarget 21; README says JDK 21). A JRE used to run Maestro does not compile the app. This skill does not install a JDK."
    );
  }

  const androidHome =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    join(process.env.HOME || "", "Library", "Android", "sdk");
  lines.push(`Android SDK: ${androidHome}`);
  if (!existsSync(androidHome)) {
    missing.push(`Android SDK directory does not exist: ${androidHome}`);
  } else {
    const platforms = existsSync(join(androidHome, "platforms"))
      ? spawnSync("ls", [join(androidHome, "platforms")], { encoding: "utf8" }).stdout.trim()
      : "(no platforms directory)";
    const buildTools = existsSync(join(androidHome, "build-tools"))
      ? spawnSync("ls", [join(androidHome, "build-tools")], { encoding: "utf8" }).stdout.trim()
      : "(no build-tools directory)";
    lines.push(`platforms:\n${platforms}`);
    lines.push(`build-tools:\n${buildTools}`);
    if (!existsSync(join(androidHome, "platforms", "android-36"))) {
      missing.push(
        "compileSdk is 36 (android/variables.gradle) but platforms/android-36 is not installed. This skill does not run sdkmanager."
      );
    }
    const emulator = join(androidHome, "emulator", "emulator");
    if (!existsSync(emulator)) {
      missing.push("emulator binary is not in the SDK.");
    } else {
      const avds = spawnSync(emulator, ["-list-avds"], { encoding: "utf8" });
      lines.push(`AVDs:\n${(avds.stdout || "").trim() || "(none)"}`);
      if (!(avds.stdout || "").trim()) {
        missing.push("No Android Virtual Device. Create one only when the SDK image is already installed.");
      }
    }
  }

  lines.push("");
  if (missing.length === 0) {
    lines.push("Android preflight passed. The emulator can be booted and the debug APK built.");
  } else {
    lines.push("Android was not started. Missing:");
    for (const item of missing) {
      lines.push(`- ${item}`);
    }
    lines.push("");
    lines.push("Linux cloud VM, once KVM and the toolchain are already there (do not install them from a verification run):");
    lines.push("- `ls -l /dev/kvm` must succeed for this user. `egrep -c '(vmx|svm)' /proc/cpuinfo` is non-zero when the CPU exposes virtualization.");
    lines.push("- JDK 21 on PATH (`javac -version` prints 21).");
    lines.push("- ANDROID_HOME with platform-tools, emulator, platforms/android-36, the build-tools version AGP 8.13 asks for, and a system image (google_apis, arm64 on Apple Silicon hosts or x86_64 on a Linux VM).");
    lines.push("- An AVD, then `emulator -avd <name> -no-window -no-audio -gpu swiftshader_indirect -no-boot-anim` and `adb wait-for-device`.");
    lines.push("- Then the same command as a prepared Mac: `node .cursor/skills/verify-london-prayer-times/native.mjs launch android`.");
  }
  return { ok: missing.length === 0, text: `${lines.join("\n")}\n`, androidHome };
}

async function launchAndroid() {
  ensureTools();
  const report = androidPreflight();
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, "android-preflight.txt"), report.text);
  process.stdout.write(report.text);
  if (!report.ok) {
    process.exitCode = 1;
    return;
  }
  requireNode24();
  const npm = join(dirname(process.execPath), "npm");
  const npx = join(dirname(process.execPath), "npx");
  await run(npm, ["run", "build"], { log: join(evidenceDir, "android-web-build.log") });
  await run(npx, ["cap", "sync", "android"], { log: join(evidenceDir, "android-cap-sync.log") });
  const androidHome = report.androidHome;
  const emulator = join(androidHome, "emulator", "emulator");
  const adb = join(androidHome, "platform-tools", "adb");
  const avd = spawnSync(emulator, ["-list-avds"], { encoding: "utf8" })
    .stdout.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)[0];
  await run(join(repoRoot, "android", "gradlew"), ["assembleDebug"], {
    cwd: join(repoRoot, "android"),
    env: { ...process.env, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome },
    log: join(evidenceDir, "android-gradle.log"),
  });
  const emuArgs = ["-avd", avd, "-netdelay", "none", "-netspeed", "full", "-no-boot-anim"];
  if (process.platform === "linux" || !process.env.DISPLAY) {
    emuArgs.push("-no-window", "-no-audio", "-gpu", "swiftshader_indirect");
  }
  const emu = spawn(emulator, emuArgs, {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ANDROID_HOME: androidHome },
  });
  emu.unref();
  writeFileSync(join(buildDir, "emulator.pid"), String(emu.pid));
  await run(adb, ["wait-for-device"], { env: { ...process.env, ANDROID_HOME: androidHome } });
  const apk = join(repoRoot, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
  await run(adb, ["install", "-r", apk]);
  writeSession({
    platform: "android",
    androidHome,
    avd,
    emulatorPid: emu.pid,
    bootedByUs: true,
  });
  console.log(JSON.stringify({ ok: true, platform: "android", avd }));
}

async function doctor(session) {
  ensureTools();
  maestroTest(writeFlow("doctor", "- launchApp"));
  sleep(5000);
  const hierarchy = spawnSync(maestroBin(), ["hierarchy"], {
    env: maestroEnv(),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const text = `${hierarchy.stdout || ""}\n${hierarchy.stderr || ""}`;
  writeFileSync(join(evidenceDir, `${session.platform}-doctor-hierarchy.txt`), text);
  const screen = text.includes("Set up")
    ? "setup"
    : text.includes("Fajr") || text.includes("Prayer Times")
      ? "home"
      : null;
  screenshot(session, "doctor");
  const report = {
    ok: hierarchy.status === 0 && screen !== null,
    platform: session.platform,
    udid: session.udid ?? null,
    name: session.name ?? null,
    runtime: session.runtime ?? null,
    screen,
  };
  console.log(JSON.stringify(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

function startRecording(session) {
  if (session.platform !== "ios") {
    return null;
  }
  const dest = join(evidenceDir, "ios-pass.mp4");
  const child = spawn(SIMCTL, ["io", session.udid, "recordVideo", "--force", "--codec=h264", dest], {
    env: { ...process.env, DEVELOPER_DIR },
    stdio: "ignore",
  });
  session.recordPid = child.pid;
  session.recordPath = dest;
  writeSession(session);
  return child;
}

function stopRecording(child) {
  if (!child || child.killed) return;
  child.kill("SIGINT");
  const started = Date.now();
  while (child.exitCode === null && Date.now() - started < 15000) {
    spawnSync("sleep", ["0.2"]);
  }
}

async function pass(session) {
  ensureTools();
  mkdirSync(evidenceDir, { recursive: true });
  const when = londonNow();
  const london = londonTimes(repoRoot, when.year, when.month, when.day);
  const belfast = belfastTimes(repoRoot, when.year, when.month, when.day);
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const foreignZone = !zonesAgree(UK_TIME_ZONE, deviceZone);
  const recorder = startRecording(session);
  const report = {
    ok: false,
    platform: session.platform,
    device: {
      name: session.name ?? null,
      runtime: session.runtime ?? null,
      udid: session.udid ?? null,
      timeZone: deviceZone,
    },
    londonDate: when,
    expectedLondon: london.expected,
    expectedHanafiAsr: london.hanafiAsr,
    expectedBelfastFajr: belfast.expected.Fajr,
    belfastFile: belfast.file,
    foreignZone,
    monthChange: {
      status: "verified-unreachable",
      reason:
        "MonthPicker is an IonIcon with no accessible name (src/components/MonthPicker.tsx). The native driver does not tap by coordinate. The open month name is checked. Row counts stay on the Playwright month spec.",
    },
    steps: [],
  };

  const runStep = (name, steps, shot) => {
    console.log(`\n--- ${name} ---`);
    try {
      maestroTest(writeFlow(name, steps));
      if (shot) screenshot(session, shot);
      report.steps.push({ name, ok: true, screenshot: shot ? `${session.platform}-${shot}.png` : null });
    } catch (error) {
      try {
        screenshot(session, "failure");
      } catch {
        // The simulator may already be gone; the maestro output is the error.
      }
      report.steps.push({ name, ok: false, error: String(error.message || error).slice(-1500) });
      throw error;
    }
  };

  try {
    runStep(
      "setup",
      `
- launchApp:
    clearState: true
    permissions:
      notifications: allow
- extendedWaitUntil:
    visible: "Set up"
    timeout: 40000
- assertVisible: "Location"
- assertVisible: "${rowValue("Location", "London")}"
- scrollUntilVisible:
    element: "Privacy policy"
    direction: DOWN
    timeout: 20000
- assertVisible: "No data leaves your device"
- scrollUntilVisible:
    element: "Done"
    direction: DOWN
    timeout: 20000
    centerElement: true
- assertVisible: "Done"
`,
      "setup"
    );

    // "Showing {location} time" and "Your device isn't on {location} time"
    // are several React text nodes. iOS exposes each one ("Showing", the
    // name, "time"), not the joined sentence. IonButton still joins
    // "Keep London time" into one label.
    const notice = foreignZone
      ? `
- extendedWaitUntil:
    visible: "Keep London time"
    timeout: 20000
- tapOn: "Keep London time"
- extendedWaitUntil:
    visible: "Showing"
    timeout: 20000
- assertVisible:
    text: "London"
    rightOf: "Showing"
    below: "${when.label}"
- assertVisible:
    text: "time"
    rightOf: "London"
    below: "${when.label}"
`
      : `
- assertNotVisible: "Your device isn't on"
`;

    runStep(
      "today",
      `
- tapOn: "Done"
${notice}
- extendedWaitUntil:
    visible: "Fajr"
    timeout: 20000
- assertVisible:
    text: "in"
    rightOf: "(Fajr|Shuruq|Duhr|Asr|Maghrib|Isha)"
${stripAsserts(london.expected)}
- assertVisible: "${when.label}"
`,
      "today-home"
    );

    runStep(
      "month",
      `
- scrollUntilVisible:
    element: "${when.monthName}"
    direction: DOWN
    timeout: 20000
- assertVisible: "${when.monthName}"
`,
      "month"
    );

    sleep(1000);
    runStep(
      "setup-persists",
      `
- stopApp
- launchApp
- extendedWaitUntil:
    visible: "Fajr"
    timeout: 30000
- assertNotVisible: "Done"
${stripAsserts(london.expected)}
`,
      "after-relaunch"
    );

    runStep(
      "settings-open",
      `
- tapOn: "Settings"
- extendedWaitUntil:
    visible: "Use Hanafi Asr"
    timeout: 15000
- assertVisible: "Location"
- assertVisible: "Privacy policy"
`,
      "settings"
    );

    runStep(
      "hanafi",
      `
- tapOn: "Use Hanafi Asr"
- waitForAnimationToEnd:
    timeout: 2000
- tapOn: "Home"
- extendedWaitUntil:
    visible: "Fajr"
    timeout: 15000
${below(london.hanafiAsr, "Asr")}
`,
      "hanafi"
    );

    sleep(1000);
    runStep(
      "hanafi-off",
      `
- tapOn: "Settings"
- extendedWaitUntil:
    visible: "Use Hanafi Asr"
    timeout: 15000
- tapOn: "Use Hanafi Asr"
- waitForAnimationToEnd:
    timeout: 2000
- tapOn: "Home"
- extendedWaitUntil:
    visible: "Fajr"
    timeout: 15000
${below(london.expected.Asr, "Asr")}
`
    );

    runStep(
      "belfast",
      `
- tapOn: "Settings"
- extendedWaitUntil:
    visible: "Location"
    timeout: 15000
- tapOn: "Location"
- tapOn:
    text: "^Belfast$"
- tapOn: "Choose"
- extendedWaitUntil:
    visible: "${rowValue("Location", "Belfast")}"
    timeout: 15000
- assertNotVisible: "Use Hanafi Asr"
- tapOn: "Home"
- extendedWaitUntil:
    visible: "Belfast"
    timeout: 15000
${below(belfast.expected.Fajr, "Fajr")}
`,
      "belfast"
    );

    sleep(1000);
    runStep(
      "london-again",
      `
- tapOn: "Settings"
- tapOn: "Location"
- tapOn:
    text: "^London$"
- tapOn: "Choose"
- extendedWaitUntil:
    visible: "Use Hanafi Asr"
    timeout: 15000
- tapOn: "Home"
- extendedWaitUntil:
    visible: "Fajr"
    timeout: 15000
${below(london.expected.Fajr, "Fajr")}
`
    );

    const widgetText =
      session.platform === "ios"
        ? "Touch and hold a widget, then choose Edit Widget"
        : "Colours and countdown for each home screen widget";
    runStep(
      "widgets",
      `
- tapOn: "Settings"
- scrollUntilVisible:
    element: "${widgetText}"
    direction: DOWN
    timeout: 20000
- assertVisible: "Widget appearance"
- assertVisible: "${widgetText}"
`,
      "widgets"
    );

    runStep(
      "theme-dark",
      `
- scrollUntilVisible:
    element: "Theme"
    direction: UP
    timeout: 20000
- tapOn: "Theme"
- tapOn:
    text: "^Dark$"
- tapOn: "Choose"
- assertVisible: "${rowValue("Theme", "Dark")}"
`,
      "theme-dark"
    );

    sleep(1000);
    runStep(
      "theme-persists",
      `
- stopApp
- launchApp
- extendedWaitUntil:
    visible: "Fajr"
    timeout: 30000
- tapOn: "Settings"
- extendedWaitUntil:
    visible: "${rowValue("Theme", "Dark")}"
    timeout: 15000
- assertVisible: "${rowValue("Theme", "Dark")}"
- tapOn: "Theme"
- tapOn:
    text: "^Light$"
- tapOn: "Choose"
- assertVisible: "${rowValue("Theme", "Light")}"
`,
      "theme-light"
    );

    runStep(
      "reminders",
      `
- scrollUntilVisible:
    element: "Notify before prayer"
    direction: DOWN
    timeout: 20000
- tapOn: "Notify before prayer"
- tapOn:
    text: "Allow"
    optional: true
- extendedWaitUntil:
    visible: "Notify 5 minutes before prayer"
    timeout: 15000
- assertVisible: "Notify 5 minutes before prayer"
`,
      "reminders"
    );

    sleep(1000);
    runStep(
      "reminders-persist",
      `
- stopApp
- launchApp
- extendedWaitUntil:
    visible: "Fajr"
    timeout: 30000
- tapOn: "Settings"
- scrollUntilVisible:
    element: "Notify 5 minutes before prayer"
    direction: DOWN
    timeout: 20000
- assertVisible: "Notify 5 minutes before prayer"
`,
      "reminders-persisted"
    );

    report.ok = report.steps.every((step) => step.ok);
  } catch (error) {
    report.ok = false;
    report.error = String(error.message || error).slice(-2000);
  } finally {
    stopRecording(recorder);
    writeFileSync(join(evidenceDir, `${session.platform}-pass.json`), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ ok: report.ok, steps: report.steps.map((step) => ({ name: step.name, ok: step.ok })) }, null, 2));
  }
  if (!report.ok) {
    process.exitCode = 1;
  }
}

function cleanup(session) {
  if (session.recordPid) {
    try {
      process.kill(session.recordPid, "SIGINT");
    } catch {
      // Recording already stopped at the end of the pass.
    }
  }
  if (session.platform === "ios") {
    simctl(["terminate", session.udid, APP_ID], { allowFail: true });
    if (session.bootedByUs) {
      simctl(["shutdown", session.udid], { allowFail: true });
      const listed = simctl(["list", "devices", "booted", "-j"], { allowFail: true });
      let anyBooted = false;
      try {
        const parsed = JSON.parse(listed.stdout || "{}");
        anyBooted = Object.values(parsed.devices || {}).some((devices) =>
          devices.some((device) => device.state === "Booted")
        );
      } catch {
        anyBooted = true;
      }
      if (!anyBooted) {
        spawnSync("osascript", ["-e", 'tell application "Simulator" to quit'], {
          stdio: "ignore",
        });
      }
    }
  } else if (session.emulatorPid) {
    try {
      process.kill(session.emulatorPid, "SIGTERM");
    } catch {
      // Already exited.
    }
    const adb = join(session.androidHome, "platform-tools", "adb");
    spawnSync(adb, ["emu", "kill"], { stdio: "ignore" });
  }
  if (existsSync(sessionPath)) {
    writeFileSync(sessionPath, "");
    spawnSync("rm", ["-f", sessionPath]);
  }
  const homeShot = join(evidenceDir, `${session.platform}-today-home.png`);
  const passJson = join(evidenceDir, `${session.platform}-pass.json`);
  console.log(
    JSON.stringify({
      evidenceStillThere: existsSync(homeShot) && existsSync(passJson),
      homeShot,
      passJson,
      sessionRemoved: !existsSync(sessionPath),
    })
  );
}

try {
  if (command === "launch" && platform === "ios") {
    await launchIos();
  } else if (command === "launch" && platform === "android") {
    await launchAndroid();
  } else if (command === "doctor") {
    await doctor(readSession());
  } else if (command === "pass") {
    await pass(readSession());
  } else if (command === "cleanup") {
    cleanup(readSession());
  }
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}
