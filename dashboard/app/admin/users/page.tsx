"use client";

import { useState, useEffect, useCallback } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { Card, Badge, EmptyState, ErrorNote } from "@/components/ui";
import {
  IconUsers,
  IconSearch,
  IconPlus,
  IconShield,
  IconTrash,
  IconEdit,
  IconCheck,
  IconX,
  IconRefresh,
  IconKey,
  IconActivity,
} from "@/components/icons";
import { withBasePath } from "@/lib/basePath";
import { formatTimeAgo } from "@/lib/format";

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  email_verified: string | null;
  created_at: string;
  actionCount: number;
  apiKeyCount: number;
  hasCustomProfile: boolean;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [verifiedFilter, setVerifiedFilter] = useState("all");

  // Modals & Inspection State
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
    isVerified: true,
  });

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [passwordResetUserId, setPasswordResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (verifiedFilter !== "all") {
        params.set("isVerified", verifiedFilter === "verified" ? "true" : "false");
      }

      const res = await fetch(withBasePath(`/api/admin/users?${params.toString()}`));
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Failed to load users");
      } else {
        setUsers(data.users || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      setError("An unexpected error occurred while fetching user accounts.");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, verifiedFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Load user detail modal
  async function inspectUser(userId: string) {
    setSelectedUserId(userId);
    setDetailLoading(true);
    try {
      const res = await fetch(withBasePath(`/api/admin/users/${userId}`));
      const data = await res.json();
      if (res.ok && data.detail) {
        setUserDetail(data.detail);
      }
    } catch (err) {
      console.error("Error loading user detail:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  // Handle Role Toggle
  async function handleToggleRole(user: AdminUser) {
    const newRole = user.role === "admin" ? "user" : "admin";
    const confirmMsg =
      newRole === "admin"
        ? `Grant administrator privileges to ${user.email}?`
        : `Demote ${user.email} from administrator to standard user?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(withBasePath(`/api/admin/users/${user.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionSuccessMessage(`Updated role for ${user.email} to ${newRole}`);
        loadUsers();
        setTimeout(() => setActionSuccessMessage(null), 4000);
      } else {
        alert(data.error || "Failed to update user role.");
      }
    } catch (err) {
      alert("Failed to update role.");
    }
  }

  // Handle Email Verification Toggle
  async function handleToggleVerification(user: AdminUser) {
    const isCurrentlyVerified = Boolean(user.email_verified);
    try {
      const res = await fetch(withBasePath(`/api/admin/users/${user.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_verified: !isCurrentlyVerified }),
      });
      if (res.ok) {
        setActionSuccessMessage(
          `Email for ${user.email} marked as ${!isCurrentlyVerified ? "Verified" : "Unverified"}`
        );
        loadUsers();
        setTimeout(() => setActionSuccessMessage(null), 4000);
      }
    } catch (err) {
      alert("Failed to update verification status.");
    }
  }

  // Handle Password Reset
  async function handleSaveNewPassword() {
    if (!passwordResetUserId || !newPassword || newPassword.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await fetch(withBasePath(`/api/admin/users/${passwordResetUserId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionSuccessMessage("Password updated successfully.");
        setPasswordResetUserId(null);
        setNewPassword("");
        setTimeout(() => setActionSuccessMessage(null), 4000);
      } else {
        alert(data.error || "Failed to reset password.");
      }
    } catch (err) {
      alert("Failed to reset password.");
    } finally {
      setUpdatingPassword(false);
    }
  }

  // Handle User Deletion
  async function handleDeleteUser(user: AdminUser) {
    if (
      !window.confirm(
        `Are you sure you want to completely delete ${user.email} and all their actions, job matches, and data? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(withBasePath(`/api/admin/users/${user.id}`), {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setActionSuccessMessage(`User ${user.email} deleted.`);
        loadUsers();
        if (selectedUserId === user.id) {
          setSelectedUserId(null);
          setUserDetail(null);
        }
        setTimeout(() => setActionSuccessMessage(null), 4000);
      } else {
        alert(data.error || "Failed to delete user.");
      }
    } catch (err) {
      alert("Failed to delete user.");
    }
  }

  // Handle Create User
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUserData.email) return;

    setCreating(true);
    try {
      const res = await fetch(withBasePath("/api/admin/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUserData),
      });
      const data = await res.json();
      if (res.ok) {
        setActionSuccessMessage(`User account for ${newUserData.email} created.`);
        setCreateUserOpen(false);
        setNewUserData({
          name: "",
          email: "",
          password: "",
          role: "user",
          isVerified: true,
        });
        loadUsers();
        setTimeout(() => setActionSuccessMessage(null), 4000);
      } else {
        alert(data.error || "Failed to create user account.");
      }
    } catch (err) {
      alert("Failed to create user.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <AdminHeader
        title="User Accounts & Permissions"
        description="Search, manage roles, audit usage, and provision accounts across the Second Brain platform."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadUsers()}
              className="press inline-flex items-center gap-1.5 rounded-xl border border-hairline/20 bg-raised px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/[0.05] transition-colors"
            >
              <IconRefresh className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              onClick={() => setCreateUserOpen(true)}
              className="press inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-accent/25 hover:bg-accent-hover transition-colors"
            >
              <IconPlus className="h-4 w-4" />
              Add User
            </button>
          </div>
        }
      />

      {actionSuccessMessage && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-400">
          ✓ {actionSuccessMessage}
        </div>
      )}

      {error && <ErrorNote message={error} />}

      {/* Filter and Search Bar */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by name, email, or user ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-hairline/20 bg-base pl-9 pr-4 py-2 text-xs text-primary placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admins Only</option>
              <option value="user">Regular Users</option>
            </select>

            <select
              value={verifiedFilter}
              onChange={(e) => setVerifiedFilter(e.target.value)}
              className="rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users List / Table */}
      <Card className="divide-y divide-hairline/15 p-0">
        <div className="hidden grid-cols-12 gap-4 px-4 py-3 bg-primary/[0.02] text-3xs font-semibold uppercase tracking-wider text-muted lg:grid">
          <div className="col-span-4">User & Email</div>
          <div className="col-span-2">Role & Verification</div>
          <div className="col-span-2">Activity & Keys</div>
          <div className="col-span-2">Registered</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-muted">
            Loading user accounts...
          </div>
        ) : users.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="No users match your criteria"
              message="Try loosening your search query or reset your filters."
            />
          </div>
        ) : (
          users.map((u) => {
            const isAdmin = u.role === "admin";
            const isVerified = Boolean(u.email_verified);

            return (
              <div
                key={u.id}
                className="flex flex-col gap-3 p-4 hover:bg-primary/[0.02] transition-colors lg:grid lg:grid-cols-12 lg:items-center lg:gap-4"
              >
                {/* Col 1: Identity */}
                <div className="flex items-center gap-3 lg:col-span-4 min-w-0">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-xs font-semibold text-accent-ink ring-1 ring-accent/25">
                    {(u.name || u.email || "U").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-primary">
                      {u.name || "Unnamed User"}
                    </p>
                    <p className="truncate text-2xs text-secondary">{u.email}</p>
                    <p className="text-3xs text-muted font-mono truncate">ID: {u.id}</p>
                  </div>
                </div>

                {/* Col 2: Role & Verification */}
                <div className="flex flex-wrap items-center gap-1.5 lg:col-span-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider ${
                      isAdmin
                        ? "bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30"
                        : "bg-primary/10 text-secondary"
                    }`}
                  >
                    {isAdmin && <IconShield className="h-3 w-3" />}
                    {u.role}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-3xs font-semibold ${
                      isVerified
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-rose-500/15 text-rose-500"
                    }`}
                  >
                    {isVerified ? "Verified" : "Unverified"}
                  </span>
                </div>

                {/* Col 3: Usage metrics */}
                <div className="flex items-center gap-3 text-2xs text-secondary lg:col-span-2">
                  <span className="flex items-center gap-1" title="Total actions">
                    <IconActivity className="h-3.5 w-3.5 text-muted" />
                    {u.actionCount}
                  </span>
                  <span className="flex items-center gap-1" title="API Keys">
                    <IconKey className="h-3.5 w-3.5 text-muted" />
                    {u.apiKeyCount}
                  </span>
                  {u.hasCustomProfile && (
                    <span className="rounded bg-accent/10 px-1.5 py-0.5 text-3xs font-medium text-accent-ink">
                      Onboarded
                    </span>
                  )}
                </div>

                {/* Col 4: Registered date */}
                <div className="text-2xs text-muted lg:col-span-2">
                  {formatTimeAgo(u.created_at)}
                </div>

                {/* Col 5: Admin Actions dropdown / buttons */}
                <div className="flex items-center justify-end gap-1.5 lg:col-span-2">
                  <button
                    onClick={() => inspectUser(u.id)}
                    className="press rounded-lg border border-hairline/20 bg-raised px-2.5 py-1 text-2xs font-semibold text-primary hover:bg-primary/[0.05]"
                  >
                    Details
                  </button>

                  <button
                    onClick={() => handleToggleRole(u)}
                    title={isAdmin ? "Demote to standard user" : "Promote to Admin"}
                    className={`press rounded-lg px-2 py-1 text-2xs font-medium transition-colors ${
                      isAdmin
                        ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                        : "bg-primary/[0.05] text-secondary hover:bg-primary/[0.1] hover:text-primary"
                    }`}
                  >
                    {isAdmin ? "Demote" : "Make Admin"}
                  </button>

                  <button
                    onClick={() => setPasswordResetUserId(u.id)}
                    title="Set new password"
                    className="press rounded-lg p-1.5 text-secondary hover:bg-primary/[0.06] hover:text-primary"
                  >
                    <IconEdit className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteUser(u)}
                    title="Delete user account"
                    className="press rounded-lg p-1.5 text-danger hover:bg-danger/10"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </Card>

      {/* ---------------- Create User Modal ---------------- */}
      {createUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-hairline/20 bg-raised p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-primary">Provision New User</h3>
              <button
                onClick={() => setCreateUserOpen(false)}
                className="text-muted hover:text-primary"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-muted mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Taylor"
                  value={newUserData.name}
                  onChange={(e) =>
                    setNewUserData({ ...newUserData, name: e.target.value })
                  }
                  className="w-full rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-muted mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={newUserData.email}
                  onChange={(e) =>
                    setNewUserData({ ...newUserData, email: e.target.value })
                  }
                  className="w-full rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-muted mb-1">
                  Initial Password (optional)
                </label>
                <input
                  type="password"
                  placeholder="Defaults to SecondBrain#2026 if empty"
                  value={newUserData.password}
                  onChange={(e) =>
                    setNewUserData({ ...newUserData, password: e.target.value })
                  }
                  className="w-full rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Role
                  </label>
                  <select
                    value={newUserData.role}
                    onChange={(e) =>
                      setNewUserData({ ...newUserData, role: e.target.value })
                    }
                    className="w-full rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none"
                  >
                    <option value="user">User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Email Verification
                  </label>
                  <select
                    value={newUserData.isVerified ? "true" : "false"}
                    onChange={(e) =>
                      setNewUserData({
                        ...newUserData,
                        isVerified: e.target.value === "true",
                      })
                    }
                    className="w-full rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none"
                  >
                    <option value="true">Pre-verified</option>
                    <option value="false">Require verification</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline/15">
                <button
                  type="button"
                  onClick={() => setCreateUserOpen(false)}
                  className="press rounded-xl px-4 py-2 text-xs font-semibold text-secondary hover:bg-primary/[0.05]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="press rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-md shadow-accent/25 hover:bg-accent-hover disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- Password Reset Modal ---------------- */}
      {passwordResetUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-hairline/20 bg-raised p-6 shadow-2xl">
            <h3 className="text-base font-bold text-primary mb-2">Reset Password</h3>
            <p className="text-2xs text-secondary mb-4">
              Enter a new secure password for this user account.
            </p>

            <input
              type="password"
              placeholder="Minimum 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none mb-4"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPasswordResetUserId(null);
                  setNewPassword("");
                }}
                className="press rounded-xl px-4 py-2 text-xs font-semibold text-secondary hover:bg-primary/[0.05]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingPassword}
                onClick={handleSaveNewPassword}
                className="press rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-md shadow-accent/25 hover:bg-accent-hover disabled:opacity-50"
              >
                {updatingPassword ? "Saving..." : "Save Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- User Details Drawer / Modal ---------------- */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-hairline/20 bg-raised p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline/15 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-primary">User Details & Telemetry</h3>
                <p className="text-2xs text-secondary font-mono">User ID: {selectedUserId}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedUserId(null);
                  setUserDetail(null);
                }}
                className="text-muted hover:text-primary"
              >
                ✕
              </button>
            </div>

            {detailLoading || !userDetail ? (
              <div className="py-12 text-center text-xs text-muted">
                Loading telemetry...
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-hairline/15 bg-base p-3">
                    <p className="text-3xs text-muted">Role</p>
                    <p className="text-xs font-bold text-primary uppercase mt-0.5">
                      {userDetail.user.role}
                    </p>
                  </div>
                  <div className="rounded-xl border border-hairline/15 bg-base p-3">
                    <p className="text-3xs text-muted">Job Matches</p>
                    <p className="text-xs font-bold text-primary mt-0.5">
                      {userDetail.stats.jobMatchesCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-hairline/15 bg-base p-3">
                    <p className="text-3xs text-muted">Resumes</p>
                    <p className="text-xs font-bold text-primary mt-0.5">
                      {userDetail.stats.resumesCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-hairline/15 bg-base p-3">
                    <p className="text-3xs text-muted">API Keys</p>
                    <p className="text-xs font-bold text-primary mt-0.5">
                      {userDetail.apiKeys.length}
                    </p>
                  </div>
                </div>

                {/* Profile Preferences */}
                <div>
                  <h4 className="text-xs font-semibold text-primary mb-2">Job Search Profile</h4>
                  {userDetail.profile ? (
                    <div className="rounded-xl border border-hairline/15 bg-base p-3.5 space-y-2 text-xs">
                      <div>
                        <span className="text-muted">Target Roles: </span>
                        <span className="text-primary font-medium">
                          {Array.isArray(userDetail.profile.targetRoles)
                            ? userDetail.profile.targetRoles.join(", ")
                            : "None specified"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted">Locations: </span>
                        <span className="text-primary font-medium">
                          {Array.isArray(userDetail.profile.preferredLocations)
                            ? userDetail.profile.preferredLocations.join(", ")
                            : "None specified"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted">Review Mode: </span>
                        <span className="text-primary font-medium capitalize">
                          {userDetail.profile.reviewMode || "Standard"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-2xs text-muted">No custom profile configured yet.</p>
                  )}
                </div>

                {/* Active API Keys */}
                <div>
                  <h4 className="text-xs font-semibold text-primary mb-2">Issued API Keys</h4>
                  {userDetail.apiKeys.length === 0 ? (
                    <p className="text-2xs text-muted">No API keys issued.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {userDetail.apiKeys.map((k: any) => (
                        <div
                          key={k.id}
                          className="flex items-center justify-between rounded-xl border border-hairline/15 bg-base px-3 py-2 text-2xs"
                        >
                          <span className="font-medium text-primary">{k.name}</span>
                          <span className="font-mono text-muted">{k.preview}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
