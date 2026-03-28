import React, { useEffect, useMemo, useState } from "react";
import type { ManagedUser, UserRole } from "../types";
import {
  createAdminUser,
  fetchAdminRoles,
  fetchAdminUsers,
  resetAdminUserPassword,
  setAdminUserAccessStatus,
  setAdminUserActive,
  updateAdminUserRoles,
} from "../services/adminUsersApi";

const FALLBACK_ROLES: UserRole[] = ["Owner", "Manager", "Sales", "Marketing"];

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>(FALLBACK_ROLES);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInactiveUsers, setShowInactiveUsers] = useState(false);

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    roles: ["Sales"] as UserRole[],
  });

  const [draftRoles, setDraftRoles] = useState<Record<string, UserRole[]>>({});
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [roles, userRows] = await Promise.all([fetchAdminRoles(), fetchAdminUsers()]);
      const roleKeys = roles.map((r) => r.key).filter(Boolean);
      setAvailableRoles(roleKeys.length ? roleKeys : FALLBACK_ROLES);
      setUsers(userRows);
      setDraftRoles(
        userRows.reduce(
          (acc, user) => {
            acc[user.id] = user.roles;
            return acc;
          },
          {} as Record<string, UserRole[]>
        )
      );
    } catch (err: any) {
      setError(String(err?.message || err || "Failed to load admin data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.email.localeCompare(b.email)),
    [users]
  );
  const activeUsers = useMemo(() => sortedUsers.filter((user) => user.active), [sortedUsers]);
  const inactiveUsers = useMemo(() => sortedUsers.filter((user) => !user.active), [sortedUsers]);

  const toggleRole = (roles: UserRole[], role: UserRole) => {
    if (roles.includes(role)) return roles.filter((r) => r !== role);
    return [...roles, role];
  };

  const createUser = async () => {
    setMessage(null);
    setError(null);
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password) {
      setError("Name, email, and password are required.");
      return;
    }
    if (newUser.password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    try {
      await createAdminUser({
        name: newUser.name.trim(),
        email: newUser.email.trim().toLowerCase(),
        password: newUser.password,
        roles: newUser.roles.length ? newUser.roles : (["Sales"] as UserRole[]),
        active: true,
      });
      setNewUser({ name: "", email: "", password: "", roles: ["Sales"] });
      setMessage("User created.");
      await load();
    } catch (err: any) {
      setError(String(err?.message || err || "Failed to create user"));
    }
  };

  const saveRoles = async (user: ManagedUser) => {
    const nextRoles = draftRoles[user.id] || [];
    if (!nextRoles.length) {
      setError("Each user must have at least one role.");
      return;
    }
    setBusyUserId(user.id);
    setMessage(null);
    setError(null);
    try {
      await updateAdminUserRoles(user.id, nextRoles);
      setMessage(`Roles updated for ${user.email}.`);
      await load();
    } catch (err: any) {
      setError(String(err?.message || err || "Failed to update roles"));
    } finally {
      setBusyUserId(null);
    }
  };

  const toggleActive = async (user: ManagedUser) => {
    setBusyUserId(user.id);
    setMessage(null);
    setError(null);
    try {
      await setAdminUserActive(user.id, !user.active);
      setMessage(`${user.email} is now ${!user.active ? "active" : "inactive"}.`);
      await load();
    } catch (err: any) {
      setError(String(err?.message || err || "Failed to update active state"));
    } finally {
      setBusyUserId(null);
    }
  };

  const updateAccessStatus = async (user: ManagedUser, accessStatus: "approved" | "pending") => {
    setBusyUserId(user.id);
    setMessage(null);
    setError(null);
    try {
      await setAdminUserAccessStatus(user.id, accessStatus);
      setMessage(
        accessStatus === "approved"
          ? `${user.email} has been approved for dashboard access.`
          : `${user.email} was moved back to pending access.`
      );
      await load();
    } catch (err: any) {
      setError(String(err?.message || err || "Failed to update access status"));
    } finally {
      setBusyUserId(null);
    }
  };

  const resetPassword = async (user: ManagedUser) => {
    const password = String(resetPasswords[user.id] || "");
    if (password.length < 4) {
      setError("Reset password must be at least 4 characters.");
      return;
    }
    setBusyUserId(user.id);
    setMessage(null);
    setError(null);
    try {
      await resetAdminUserPassword(user.id, password);
      setResetPasswords((curr) => ({ ...curr, [user.id]: "" }));
      setMessage(`Password reset for ${user.email}.`);
    } catch (err: any) {
      setError(String(err?.message || err || "Failed to reset password"));
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">User Management</h2>
            <p className="text-sm text-slate-500">
              Create employee accounts, assign roles, and reset passwords.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
        {message && <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
        {error && <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900">Create User</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={newUser.name}
            onChange={(event) => setNewUser((curr) => ({ ...curr, name: event.target.value }))}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Full name"
          />
          <input
            value={newUser.email}
            onChange={(event) => setNewUser((curr) => ({ ...curr, email: event.target.value }))}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Email"
          />
          <input
            type="password"
            value={newUser.password}
            onChange={(event) => setNewUser((curr) => ({ ...curr, password: event.target.value }))}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Temporary password"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {availableRoles.map((role) => {
            const enabled = newUser.roles.includes(role);
            return (
              <button
                key={role}
                type="button"
                onClick={() =>
                  setNewUser((curr) => ({
                    ...curr,
                    roles: toggleRole(curr.roles, role),
                  }))
                }
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  enabled
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {role}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => void createUser()}
          className="mt-3 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Create Employee User
        </button>
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Active Users</h3>
            <p className="text-sm text-slate-500">
              Inactive employees are moved into a separate reactivation list below.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {activeUsers.length} active
          </div>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading users...</p>
        ) : activeUsers.length ? (
          <div className="mt-4 space-y-4">
            {activeUsers.map((user) => {
              const roles = draftRoles[user.id] || user.roles;
              const busy = busyUserId === user.id;
              return (
                <div key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-600">{user.email}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        {user.phone ? <span>{user.phone}</span> : <span>No phone on file</span>}
                        <span>•</span>
                        <span>{user.authProvider === "google" ? "Google Workspace" : "Password login"}</span>
                        {user.permissionMode === "explicit" && (
                          <>
                            <span>•</span>
                            <span>{user.explicitPermissionCount || 0} custom permission overrides</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          user.accessStatus === "approved"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {user.accessStatus === "approved" ? "Approved" : "Pending"}
                      </div>
                      <div
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        user.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {user.active ? "Active" : "Inactive"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {availableRoles.map((role) => {
                      const enabled = roles.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() =>
                            setDraftRoles((curr) => ({
                              ...curr,
                              [user.id]: toggleRole(roles, role),
                            }))
                          }
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            enabled
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-white text-slate-600"
                          }`}
                        >
                          {role}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[auto_auto_auto_1fr_auto]">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveRoles(user)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                    >
                      Save Roles
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleActive(user)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                    >
                      {user.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateAccessStatus(user, user.accessStatus === "approved" ? "pending" : "approved")}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                        user.accessStatus === "approved"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {user.accessStatus === "approved" ? "Move To Pending" : "Approve Access"}
                    </button>
                    <input
                      type="password"
                      value={resetPasswords[user.id] || ""}
                      onChange={(event) =>
                        setResetPasswords((curr) => ({
                          ...curr,
                          [user.id]: event.target.value,
                        }))
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
                      placeholder="New password"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void resetPassword(user)}
                      className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 disabled:opacity-60"
                    >
                      Reset Password
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No active users found.</p>
        )}
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Inactive Users</h3>
            <p className="text-sm text-slate-500">
              Keep old employee records here so they can be reactivated later without cluttering the main list.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInactiveUsers((current) => !current)}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {showInactiveUsers ? "Hide Inactive Users" : `Show Inactive Users (${inactiveUsers.length})`}
          </button>
        </div>

        {showInactiveUsers ? (
          inactiveUsers.length ? (
            <div className="mt-4 space-y-3">
              {inactiveUsers.map((user) => {
                const busy = busyUserId === user.id;
                return (
                  <div key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                        <div className="text-xs text-slate-600">{user.email}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                          {user.roles.length ? <span>{user.roles.join(", ")}</span> : <span>No roles assigned</span>}
                          <span>•</span>
                          <span>{user.authProvider === "google" ? "Google Workspace" : "Password login"}</span>
                          <span>•</span>
                          <span>{user.accessStatus === "approved" ? "Approved access" : "Pending access"}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleActive(user)}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-60"
                      >
                        Reactivate User
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No inactive users right now.</p>
          )
        ) : (
          <p className="mt-4 text-sm text-slate-500">Inactive users are hidden until you need to reactivate someone.</p>
        )}
      </section>
    </div>
  );
};

export default AdminUsers;
