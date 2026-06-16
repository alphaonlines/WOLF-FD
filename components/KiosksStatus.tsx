import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  HardDrive,
  Laptop,
  Monitor,
  RefreshCw,
  RotateCcw,
  Settings,
  Smartphone,
  Wifi,
  WifiOff,
} from "lucide-react";

type SystemStatus = "Online" | "Offline";
type DeviceType = "Desktop" | "Tablet" | "Mini" | "Kiosk";
type ActionKey = "remote" | "settings" | "reboot" | "update" | "backup";

type AlphaSystem = {
  id: string;
  location: string;
  systemName: string;
  deviceType: DeviceType;
  role: string;
  status: SystemStatus;
  version: string;
  uptime: string;
  cpu: string;
  ram: string;
  storage: string;
  lastSeen: string;
  lastBackup: string;
  ipAddress: string;
  notes: string;
};

const alphaSystems: AlphaSystem[] = [
  {
    id: "fd7-desktop",
    location: "FD7",
    systemName: "FD7 Desktop",
    deviceType: "Desktop",
    role: "Main showroom console",
    status: "Online",
    version: "AlphaOS 3.29.10",
    uptime: "18d 04h",
    cpu: "Intel Core i5-9500T / 6 cores",
    ram: "16 GB DDR4",
    storage: "512 GB SSD / 196 GB free",
    lastSeen: "Now",
    lastBackup: "Today 02:12",
    ipAddress: "192.168.4.71",
    notes: "Primary floor control station for FD7.",
  },
  {
    id: "fd7-tablet",
    location: "FD7",
    systemName: "FD7T",
    deviceType: "Tablet",
    role: "Sales floor tablet",
    status: "Online",
    version: "AlphaOS 3.29.10",
    uptime: "7d 09h",
    cpu: "Snapdragon 7c / 8 cores",
    ram: "8 GB",
    storage: "128 GB SSD / 59 GB free",
    lastSeen: "Now",
    lastBackup: "Today 01:40",
    ipAddress: "192.168.4.72",
    notes: "Tablet assigned to the front half of the FD7 floor.",
  },
  {
    id: "fd7-tablet-1",
    location: "FD7",
    systemName: "FD7T1",
    deviceType: "Tablet",
    role: "Sales floor tablet",
    status: "Online",
    version: "AlphaOS 3.29.10",
    uptime: "5d 13h",
    cpu: "Snapdragon 7c / 8 cores",
    ram: "8 GB",
    storage: "128 GB SSD / 64 GB free",
    lastSeen: "Now",
    lastBackup: "Today 01:42",
    ipAddress: "192.168.4.73",
    notes: "Tablet assigned to the back half of the FD7 floor.",
  },
  {
    id: "fd7-a-mini",
    location: "FD7",
    systemName: "FD7A (mini)",
    deviceType: "Mini",
    role: "Archbold kiosk",
    status: "Offline",
    version: "AlphaOS 3.28.22",
    uptime: "Unavailable",
    cpu: "Intel Celeron J6412 / 4 cores",
    ram: "8 GB DDR4",
    storage: "256 GB SSD / last seen 88 GB free",
    lastSeen: "Today 08:14",
    lastBackup: "Yesterday 23:12",
    ipAddress: "192.168.4.74",
    notes: "Last heartbeat dropped during morning floor power cycle.",
  },
  {
    id: "fd7-b-mini",
    location: "FD7",
    systemName: "FD7B (mini)",
    deviceType: "Mini",
    role: "Best kiosk",
    status: "Offline",
    version: "AlphaOS 3.28.22",
    uptime: "Unavailable",
    cpu: "Intel Celeron J6412 / 4 cores",
    ram: "8 GB DDR4",
    storage: "256 GB SSD / last seen 92 GB free",
    lastSeen: "Today 08:11",
    lastBackup: "Yesterday 23:15",
    ipAddress: "192.168.4.75",
    notes: "Needs remote check after the last content sync window.",
  },
  {
    id: "fd7-e-mini",
    location: "FD7",
    systemName: "FD7E (mini)",
    deviceType: "Mini",
    role: "England kiosk",
    status: "Offline",
    version: "AlphaOS 3.28.22",
    uptime: "Unavailable",
    cpu: "Intel Celeron J6412 / 4 cores",
    ram: "8 GB DDR4",
    storage: "256 GB SSD / last seen 91 GB free",
    lastSeen: "Today 08:09",
    lastBackup: "Yesterday 23:18",
    ipAddress: "192.168.4.76",
    notes: "Offline since the England media package refresh started.",
  },
  {
    id: "fd71-mini",
    location: "FD7",
    systemName: "FD71 (mini)",
    deviceType: "Mini",
    role: "Overflow kiosk",
    status: "Online",
    version: "AlphaOS 3.29.10",
    uptime: "12d 01h",
    cpu: "Intel N5105 / 4 cores",
    ram: "8 GB DDR4",
    storage: "256 GB SSD / 104 GB free",
    lastSeen: "Now",
    lastBackup: "Today 02:08",
    ipAddress: "192.168.4.77",
    notes: "Running the overflow rotation near recliners.",
  },
  {
    id: "fd5-kiosk",
    location: "FD5",
    systemName: "FD5",
    deviceType: "Kiosk",
    role: "Primary FD5 kiosk",
    status: "Online",
    version: "AlphaOS 3.29.10",
    uptime: "11d 19h",
    cpu: "Intel N5105 / 4 cores",
    ram: "8 GB DDR4",
    storage: "256 GB SSD / 110 GB free",
    lastSeen: "Now",
    lastBackup: "Today 02:05",
    ipAddress: "192.168.4.81",
    notes: "Healthy and serving the full catalog rotation.",
  },
  {
    id: "fd51-mini",
    location: "FD5",
    systemName: "FD51 (mini)",
    deviceType: "Mini",
    role: "Mini kiosk",
    status: "Online",
    version: "AlphaOS 3.29.10",
    uptime: "9d 06h",
    cpu: "Intel N5105 / 4 cores",
    ram: "8 GB DDR4",
    storage: "256 GB SSD / 97 GB free",
    lastSeen: "Now",
    lastBackup: "Today 02:00",
    ipAddress: "192.168.4.82",
    notes: "Mounted near the accent wall for fast lookup.",
  },
  {
    id: "fd52",
    location: "FD5",
    systemName: "FD52",
    deviceType: "Kiosk",
    role: "Secondary kiosk",
    status: "Offline",
    version: "AlphaOS 3.28.22",
    uptime: "Unavailable",
    cpu: "Intel N5105 / 4 cores",
    ram: "8 GB DDR4",
    storage: "256 GB SSD / last seen 83 GB free",
    lastSeen: "Yesterday 21:46",
    lastBackup: "Yesterday 02:04",
    ipAddress: "192.168.4.83",
    notes: "Missed the overnight update window and dropped offline.",
  },
  {
    id: "g1-kiosk",
    location: "G1",
    systemName: "G1",
    deviceType: "Kiosk",
    role: "Main Greenville kiosk",
    status: "Online",
    version: "AlphaOS 3.29.10",
    uptime: "16d 02h",
    cpu: "Intel N5105 / 4 cores",
    ram: "8 GB DDR4",
    storage: "256 GB SSD / 118 GB free",
    lastSeen: "Now",
    lastBackup: "Today 01:56",
    ipAddress: "192.168.4.91",
    notes: "Greenville front-of-store kiosk.",
  },
  {
    id: "g11-mini",
    location: "G1",
    systemName: "G11 (mini)",
    deviceType: "Mini",
    role: "Satellite mini",
    status: "Offline",
    version: "AlphaOS 3.28.22",
    uptime: "Unavailable",
    cpu: "Intel Celeron J6412 / 4 cores",
    ram: "8 GB DDR4",
    storage: "256 GB SSD / last seen 79 GB free",
    lastSeen: "Today 07:58",
    lastBackup: "Yesterday 01:52",
    ipAddress: "192.168.4.92",
    notes: "Dropped after the router swap; likely needs remote-in first.",
  },
  {
    id: "base-kiosk",
    location: "Base",
    systemName: "Base",
    deviceType: "Kiosk",
    role: "Base showroom kiosk",
    status: "Online",
    version: "AlphaOS 3.29.10",
    uptime: "14d 20h",
    cpu: "Intel N5105 / 4 cores",
    ram: "8 GB DDR4",
    storage: "256 GB SSD / 112 GB free",
    lastSeen: "Now",
    lastBackup: "Today 01:48",
    ipAddress: "192.168.4.101",
    notes: "Stable station with the latest catalog image.",
  },
  {
    id: "camp-kiosk",
    location: "Camp",
    systemName: "Camp",
    deviceType: "Kiosk",
    role: "Camp showroom kiosk",
    status: "Online",
    version: "AlphaOS 3.29.10",
    uptime: "21d 08h",
    cpu: "Intel N5105 / 4 cores",
    ram: "8 GB DDR4",
    storage: "256 GB SSD / 121 GB free",
    lastSeen: "Now",
    lastBackup: "Today 01:44",
    ipAddress: "192.168.4.111",
    notes: "Longest-running kiosk in the fleet right now.",
  },
  {
    id: "fd-user-mini",
    location: "Shared",
    systemName: "FDUser (mini)",
    deviceType: "Mini",
    role: "Shared support station",
    status: "Online",
    version: "AlphaOS 3.29.10",
    uptime: "4d 17h",
    cpu: "Intel N5105 / 4 cores",
    ram: "8 GB DDR4",
    storage: "256 GB SSD / 101 GB free",
    lastSeen: "Now",
    lastBackup: "Today 01:30",
    ipAddress: "192.168.4.120",
    notes: "Shared spare unit for remote support and staging.",
  },
  {
    id: "fd10-mini",
    location: "Shared",
    systemName: "FD10 (mini)",
    deviceType: "Mini",
    role: "Spare / lab unit",
    status: "Offline",
    version: "AlphaOS 3.28.18",
    uptime: "Unavailable",
    cpu: "Intel Celeron J6412 / 4 cores",
    ram: "8 GB DDR4",
    storage: "256 GB SSD / last seen 95 GB free",
    lastSeen: "Yesterday 18:20",
    lastBackup: "2026-03-27 22:11",
    ipAddress: "192.168.4.121",
    notes: "Spare unit staged for the next replacement cycle.",
  },
];

const locationOrder = ["FD7", "FD5", "G1", "Base", "Camp", "Shared"];

const getDeviceIcon = (deviceType: DeviceType) => {
  if (deviceType === "Desktop" || deviceType === "Kiosk") {
    return Monitor;
  }
  if (deviceType === "Tablet") {
    return Smartphone;
  }
  return Laptop;
};

const getStatusClasses = (status: SystemStatus) =>
  status === "Online"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-rose-200 bg-rose-50 text-rose-700";

const getCardClasses = (status: SystemStatus, isExpanded: boolean) => {
  if (status === "Offline") {
    return isExpanded
      ? "border-rose-200 bg-rose-50/70 shadow-sm"
      : "border-rose-100 bg-white hover:border-rose-200";
  }

  return isExpanded
    ? "border-slate-300 bg-slate-50 shadow-sm"
    : "border-slate-100 bg-white hover:border-slate-200";
};

const KiosksStatus: React.FC = () => {
  const [expandedSystemId, setExpandedSystemId] = useState<string>(alphaSystems[0].id);
  const [actionMessage, setActionMessage] = useState<string>("Remote support, reboot, updates, and backups are now staged per system from this screen.");

  const groupedSystems = useMemo(() => {
    const groups = new Map<string, AlphaSystem[]>();

    for (const system of alphaSystems) {
      const existing = groups.get(system.location) ?? [];
      existing.push(system);
      groups.set(system.location, existing);
    }

    return locationOrder
      .filter((location) => groups.has(location))
      .map((location) => ({ location, systems: groups.get(location) ?? [] }));
  }, []);

  const selectedSystem = alphaSystems.find((system) => system.id === expandedSystemId) ?? alphaSystems[0];
  const totalSystems = alphaSystems.length;
  const onlineCount = alphaSystems.filter((system) => system.status === "Online").length;
  const offlineCount = totalSystems - onlineCount;
  const latestVersionCount = alphaSystems.filter((system) => system.version === "AlphaOS 3.29.10").length;
  const backedUpTodayCount = alphaSystems.filter((system) => system.lastBackup.startsWith("Today")).length;

  const triggerAction = (action: ActionKey, system: AlphaSystem) => {
    const messages: Record<ActionKey, string> = {
      remote: `Remote-in selected for ${system.systemName}. Wire this button to your remote target when you're ready to execute live support sessions.`,
      settings: `Settings selected for ${system.systemName}. This is the right slot to open device-specific AlphaOS controls.`,
      reboot: `Reboot queued for ${system.systemName}. Hook this action to your device command service before using it live.`,
      update: `Update queued for ${system.systemName}. This row is ready for a version rollout endpoint.`,
      backup: `Backup queued for ${system.systemName}. Connect it to your snapshot or image backup job when that service is ready.`,
    };

    setExpandedSystemId(system.id);
    setActionMessage(messages[action]);
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Fleet</div>
          <div className="mt-3 text-3xl font-semibold text-slate-950">{totalSystems}</div>
          <p className="mt-2 text-sm text-slate-500">Systems tracked across showroom, tablets, kiosks, and shared minis.</p>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Online</div>
          <div className="mt-3 text-3xl font-semibold text-emerald-950">{onlineCount}</div>
          <p className="mt-2 text-sm text-emerald-900/75">Remote-in ready systems with current live heartbeat.</p>
        </div>
        <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">Needs Attention</div>
          <div className="mt-3 text-3xl font-semibold text-rose-950">{offlineCount}</div>
          <p className="mt-2 text-sm text-rose-900/75">Offline systems that may need remote support, reboot, or onsite power checks.</p>
        </div>
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Current Version</div>
          <div className="mt-3 text-3xl font-semibold text-blue-950">{latestVersionCount}</div>
          <p className="mt-2 text-sm text-blue-900/75">{backedUpTodayCount} systems show a same-day backup snapshot.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">AlphaOS Command Board</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Per-system controls and live hardware view</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Open any system below to view uptime, version, CPU, RAM, storage, last backup, and quick controls for remote-in,
              settings, reboot, update, and backup.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 lg:max-w-md">
            <div className="font-semibold text-slate-900">Selected system</div>
            <div className="mt-1">{selectedSystem.systemName}</div>
            <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
              {selectedSystem.location} · {selectedSystem.version} · {selectedSystem.uptime}
            </div>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {actionMessage}
        </div>
      </section>

      {groupedSystems.map(({ location, systems }) => {
        const locationOnline = systems.filter((system) => system.status === "Online").length;
        const locationOffline = systems.length - locationOnline;

        return (
          <section key={location} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">{location}</h3>
                <p className="text-sm text-slate-500">
                  {systems.length} systems tracked · {locationOnline} online · {locationOffline} offline
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  All controls available per system
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {systems.map((system) => {
                const DeviceIcon = getDeviceIcon(system.deviceType);
                const isExpanded = expandedSystemId === system.id;

                return (
                  <div
                    key={system.id}
                    className={`rounded-3xl border p-4 transition-colors ${getCardClasses(system.status, isExpanded)}`}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">
                          <DeviceIcon size={20} />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-lg font-semibold text-slate-950">{system.systemName}</h4>
                            <span
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(system.status)}`}
                            >
                              {system.status === "Online" ? <Wifi size={12} /> : <WifiOff size={12} />}
                              {system.status}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {system.role} · {system.deviceType} · {system.version}
                          </p>
                          <p className="mt-2 text-sm text-slate-700">
                            Uptime <span className="font-semibold text-slate-950">{system.uptime}</span> · Last seen {system.lastSeen}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
                          onClick={() => triggerAction("remote", system)}
                        >
                          <ArrowUpRight size={16} />
                          Remote In
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                          onClick={() => setExpandedSystemId(isExpanded ? "" : system.id)}
                        >
                          {isExpanded ? "Hide stats" : "View stats"}
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                              <Cpu size={14} />
                              CPU
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-950">{system.cpu}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                              <Monitor size={14} />
                              RAM
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-950">{system.ram}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                              <HardDrive size={14} />
                              Storage
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-950">{system.storage}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Version / IP</div>
                            <div className="mt-2 text-sm font-semibold text-slate-950">{system.version}</div>
                            <div className="mt-1 text-xs text-slate-500">{system.ipAddress}</div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            onClick={() => triggerAction("settings", system)}
                          >
                            <Settings size={16} />
                            Settings
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            onClick={() => triggerAction("reboot", system)}
                          >
                            <RotateCcw size={16} />
                            Reboot
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            onClick={() => triggerAction("update", system)}
                          >
                            <RefreshCw size={16} />
                            Update
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            onClick={() => triggerAction("backup", system)}
                          >
                            <HardDrive size={16} />
                            Backup
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Last Backup</div>
                            <div className="mt-2 text-sm font-semibold text-slate-950">{system.lastBackup}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Last Seen</div>
                            <div className="mt-2 text-sm font-semibold text-slate-950">{system.lastSeen}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Role</div>
                            <div className="mt-2 text-sm font-semibold text-slate-950">{system.role}</div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                          <span className="font-semibold text-slate-950">Notes:</span> {system.notes}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default KiosksStatus;
