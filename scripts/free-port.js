const { execFileSync } = require("child_process");
const dotenv = require("dotenv");

dotenv.config();

const port = Number(process.env.PORT || 4000);

if (!Number.isInteger(port) || port <= 0) {
  process.exit(0);
}

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch (_error) {
    return "";
  }
}

function killWindowsPort() {
  const script = [
    `$items = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue`,
    "foreach ($item in $items) {",
    "  try { Stop-Process -Id $item.OwningProcess -Force -ErrorAction Stop } catch {}",
    "}",
  ].join("; ");
  run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script]);
}

function killUnixPort() {
  const pidList = run("sh", ["-c", `lsof -ti tcp:${port}`]);
  pidList
    .split(/\s+/)
    .filter(Boolean)
    .forEach((pid) => {
      run("kill", ["-9", pid]);
    });
}

if (process.platform === "win32") {
  killWindowsPort();
} else {
  killUnixPort();
}
