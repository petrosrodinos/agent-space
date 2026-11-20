import { BROWSER_PROFILE, HOME } from './computer.paths';

/** What "Clean up" can clear on the computer. Never touches the workspace or website sign-ins. */
export const CleanupTargets = {
    /** App and browser caches (~/.cache, Chromium Cache/Code Cache/GPUCache). Sign-ins are kept. */
    CACHE: 'cache',
    /** The bot's own temporary files in /tmp (hidden desktop sockets are kept). */
    TEMP: 'temp',
    /** The desktop's trash folder. */
    TRASH: 'trash',
    /** Closes the browser and ends other programs the bot left running, to free memory. The desktop keeps running. */
    PROGRAMS: 'programs',
} as const;
export type CleanupTarget = (typeof CleanupTargets)[keyof typeof CleanupTargets];

export const STATS_SCRIPT_PATH = `${HOME}/.agentspace/stats.py`;
export const CLEANUP_SCRIPT_PATH = `${HOME}/.agentspace/cleanup.py`;

const CACHE_DIRS = [`${HOME}/.cache`, `${BROWSER_PROFILE}/Default/Cache`, `${BROWSER_PROFILE}/Default/Code Cache`, `${BROWSER_PROFILE}/Default/GPUCache`, `${BROWSER_PROFILE}/ShaderCache`, `${BROWSER_PROFILE}/GrShaderCache`];
const TRASH_DIR = `${HOME}/.local/share/Trash`;

/**
 * Programs the desktop, live view and Daytona itself need. "PROGRAMS" cleanup never ends these, and "TEMP" never deletes
 * /tmp entries whose name contains one of them (e.g. Daytona's /tmp/daytona_repl_worker.py). Matched against the
 * process program path and script name (not its flags) / the file name.
 */
const PROTECTED = ['Xvfb', 'xfce4', 'xfwm4', 'xfdesktop', 'xfsettingsd', 'xfconfd', 'Thunar', 'x11vnc', 'novnc', 'websockify', 'dbus', 'daytona', 'sshd', 'ssh-', 'tini', 'dumb-init', 'supervisord', 'at-spi', 'pulse', 'vnc', 'stats.py', 'cleanup.py'];
/** Shells and keep-alive helpers Daytona runs its sessions in (verified on a live sandbox). Never ended. */
const SYSTEM_NAMES = ['zsh', 'bash', 'sh', 'dash', 'sleep', 'tail', 'init', 'ps'];

/** Python shared by both scripts: folder sizes and the bot's own (non-protected) processes. */
const COMMON_PY = `
import os, json, time, shutil, signal, stat as _s
HOME = ${JSON.stringify(HOME)}
CACHE_DIRS = ${JSON.stringify(CACHE_DIRS)}
TRASH_DIR = ${JSON.stringify(TRASH_DIR)}
PROTECTED = ${JSON.stringify(PROTECTED)}
SYSTEM_NAMES = set(${JSON.stringify(SYSTEM_NAMES)})
ME = os.getuid()

def ancestors():
    out, pid = set(), os.getpid()
    while pid > 1:
        out.add(pid)
        try:
            with open(f"/proc/{pid}/stat") as f: pid = int(f.read().rsplit(")", 1)[1].split()[1])
        except (OSError, ValueError, IndexError): break
    return out

def dir_size(p):
    total = 0
    for root, dirs, files in os.walk(p, onerror=lambda e: None):
        for f in files:
            try: total += os.lstat(os.path.join(root, f)).st_size
            except OSError: pass
    return total

def temp_entries():
    out = []
    try:
        for n in os.listdir("/tmp"):
            if n.startswith(".") or any(k.lower() in n.lower() for k in PROTECTED): continue
            p = os.path.join("/tmp", n)
            try:
                st = os.lstat(p)
                if st.st_uid == ME and not _s.S_ISSOCK(st.st_mode) and not _s.S_ISFIFO(st.st_mode): out.append(p)
            except OSError: pass
    except OSError: pass
    return out

def path_size(p):
    try:
        return dir_size(p) if os.path.isdir(p) and not os.path.islink(p) else os.lstat(p).st_size
    except OSError:
        return 0

def processes():
    page = os.sysconf("SC_PAGE_SIZE")
    mine = ancestors()
    out = []
    for pid in os.listdir("/proc"):
        if not pid.isdigit() or int(pid) == 1 or int(pid) in mine: continue
        try:
            with open(f"/proc/{pid}/cmdline", "rb") as f: argv = [a.decode(errors="replace") for a in f.read().split(b"\\0") if a]
            if not argv: continue
            cmd = " ".join(argv)
            # Who a process is = its program path plus the script/module it runs, never its flags (a browser flag like
            # --user-data-dir=/home/daytona/... must not make it look like Daytona's own process).
            # Chromium children rewrite argv into one space-joined string, so cut argv[0] at its first flag.
            ident = " ".join([argv[0].split(" -")[0]] + [os.path.basename(a) for a in argv[1:] if not a.startswith("-")][:2])
            with open(f"/proc/{pid}/statm") as f: rss = int(f.read().split()[1]) * page
            # PSS splits shared pages between the processes using them, so Chromium's many processes aren't counted several times.
            try:
                with open(f"/proc/{pid}/smaps_rollup") as f:
                    for line in f:
                        if line.startswith("Pss:"): rss = int(line.split()[1]) * 1024; break
            except OSError: pass
            with open(f"/proc/{pid}/stat") as f: st = f.read().rsplit(")", 1)[1].split()
            with open(f"/proc/{pid}/comm") as f: name = f.read().strip()
            uid = os.stat(f"/proc/{pid}").st_uid
            out.append({"pid": int(pid), "name": name, "command": cmd[:200], "memory_bytes": rss, "cpu_ticks": int(st[11]) + int(st[12]), "uid": uid,
                        "protected": name in SYSTEM_NAMES or any(k in ident for k in PROTECTED)})
        except (OSError, ValueError, IndexError):
            pass
    return out
`;

/** Prints one JSON object with memory, CPU, disk and what a cleanup could free. Prefers cgroup limits (the sandbox's real allocation). */
export const STATS_PY = `${COMMON_PY}
def read(p):
    try:
        with open(p) as f: return f.read().strip()
    except OSError: return None

def num(v):
    try: return int(v)
    except (TypeError, ValueError): return None

def meminfo():
    m = {}
    for line in (read("/proc/meminfo") or "").splitlines():
        k, v = line.split(":", 1)
        m[k] = int(v.split()[0]) * 1024
    return m

mi = meminfo()
mem_used = num(read("/sys/fs/cgroup/memory.current")) or num(read("/sys/fs/cgroup/memory/memory.usage_in_bytes"))
mem_limit = num(read("/sys/fs/cgroup/memory.max")) or num(read("/sys/fs/cgroup/memory/memory.limit_in_bytes"))
if mem_used is not None:
    # Page cache is reclaimable; report what programs actually hold, like "free" does.
    stat = dict(l.split() for l in (read("/sys/fs/cgroup/memory.stat") or read("/sys/fs/cgroup/memory/memory.stat") or "").splitlines() if len(l.split()) == 2)
    mem_used = max(0, mem_used - (num(stat.get("inactive_file")) or num(stat.get("total_inactive_file")) or 0))
else:
    mem_used = mi.get("MemTotal", 0) - mi.get("MemAvailable", 0)
if not mem_limit or mem_limit > mi.get("MemTotal", 0) * 4:
    mem_limit = mi.get("MemTotal", 0)

def cpu_usec():
    s = read("/sys/fs/cgroup/cpu.stat")
    if s:
        for l in s.splitlines():
            if l.startswith("usage_usec"): return int(l.split()[1])
    v = num(read("/sys/fs/cgroup/cpuacct/cpuacct.usage"))
    return v // 1000 if v is not None else None

def proc_cpu():
    f = [int(x) for x in (read("/proc/stat") or "cpu 0 0 0 0").splitlines()[0].split()[1:]]
    return sum(f), f[3] + (f[4] if len(f) > 4 else 0)

cpus = os.cpu_count() or 1
cg = (read("/sys/fs/cgroup/cpu.max") or "").split()
if len(cg) == 2 and cg[0] != "max": cpus = max(0.1, int(cg[0]) / int(cg[1]))
ticks = os.sysconf("SC_CLK_TCK")
p0 = {p["pid"]: p["cpu_ticks"] for p in processes()}
u0, t0, w0 = cpu_usec(), proc_cpu(), time.time()
time.sleep(0.5)
u1, t1, w1 = cpu_usec(), proc_cpu(), time.time()
if u0 is not None and u1 is not None:
    cpu_pct = (u1 - u0) / ((w1 - w0) * 1e6 * cpus) * 100
else:
    dt = t1[0] - t0[0]
    cpu_pct = (1 - (t1[1] - t0[1]) / dt) * 100 if dt else 0
procs = processes()
for p in procs:
    p["cpu_percent"] = round(max(0, p["cpu_ticks"] - p0.get(p["pid"], p["cpu_ticks"])) / ticks / (w1 - w0) / cpus * 100, 1)

du = shutil.disk_usage(HOME)
try: uptime = int(float((read("/proc/uptime") or "0").split()[0]))
except ValueError: uptime = 0
load = (read("/proc/loadavg") or "0 0 0").split()[:3]
top = sorted(procs, key=lambda p: p["memory_bytes"], reverse=True)[:8]
print(json.dumps({
    "cpu": {"percent": round(min(100, max(0, cpu_pct)), 1), "cores": round(cpus, 2), "load": [float(x) for x in load]},
    "memory": {"used_bytes": mem_used, "total_bytes": mem_limit},
    "disk": {"used_bytes": du.used, "total_bytes": du.total, "home_bytes": dir_size(HOME)},
    "uptime_seconds": uptime,
    "reclaimable": {
        "cache": sum(dir_size(d) for d in CACHE_DIRS),
        "temp": sum(path_size(p) for p in temp_entries()),
        "trash": dir_size(TRASH_DIR),
        "programs": sum(p["memory_bytes"] for p in procs if not p["protected"] and p["uid"] == ME),
    },
    "processes": [{"pid": p["pid"], "name": p["name"], "command": p["command"], "memory_bytes": p["memory_bytes"], "cpu_percent": p["cpu_percent"], "protected": p["protected"]} for p in top],
}))
`;

/** Clears the targets given as arguments and prints {"freed_bytes": {target: n}}. */
export const CLEANUP_PY = `${COMMON_PY}
import sys
targets = set(sys.argv[1:])
freed = {}

def rm(p):
    n = path_size(p)
    try:
        if os.path.isdir(p) and not os.path.islink(p): shutil.rmtree(p, ignore_errors=True)
        else: os.remove(p)
    except OSError: pass
    return n - path_size(p)

if "programs" in targets:
    mine = [p for p in processes() if not p["protected"] and p["uid"] == ME]
    freed["programs"] = sum(p["memory_bytes"] for p in mine)
    for p in mine:
        try: os.kill(p["pid"], signal.SIGTERM)
        except OSError: pass
    time.sleep(1.5)
    for p in mine:
        try: os.kill(p["pid"], signal.SIGKILL)
        except OSError: pass
if "cache" in targets:
    total = 0
    for d in CACHE_DIRS:
        if not os.path.isdir(d): continue
        for n in os.listdir(d): total += rm(os.path.join(d, n))
    freed["cache"] = total
if "temp" in targets:
    freed["temp"] = sum(rm(p) for p in temp_entries())
if "trash" in targets:
    total = 0
    for sub in ("files", "info", "expunged"):
        d = os.path.join(TRASH_DIR, sub)
        if os.path.isdir(d):
            for n in os.listdir(d): total += rm(os.path.join(d, n))
    freed["trash"] = total
print(json.dumps({"freed_bytes": freed}))
`;
