import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Moon, Plus, Sun, UserRound } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { api } from "@/lib/api";
import { cn, formatRelative } from "@/lib/utils";
import type { NotificationItem } from "@/types";

const links = [
  { to: "/dashboard", label: "Workspace" },
  { to: "/research/new", label: "Research studio" },
  { to: "/monitoring", label: "Monitoring" },
];

export function TopNav() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const { data: notifications = [], refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<NotificationItem[]>("/notifications"),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = notifications.filter((item) => !item.read).length;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-md">
      <div className="page-shell flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Logo to="/dashboard" />
          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    "link-underline text-[13px] transition-colors",
                    isActive ? "text-ink" : "text-muted hover:text-ink",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2" ref={menuRef}>
          <Link to="/research/new" className="hidden sm:block">
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
              New analysis
            </Button>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-line text-muted transition-colors hover:text-ink"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((open) => !open);
                setAccountOpen(false);
                if (!notificationsOpen) void refetch();
              }}
              aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
              className="relative flex h-8 w-8 items-center justify-center rounded-sm border border-line text-muted transition-colors hover:text-ink"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-negative px-1 font-mono text-[9px] text-white">
                  {unread}
                </span>
              ) : null}
            </button>
            {notificationsOpen ? (
              <div className="absolute right-0 top-11 w-[320px] border border-line bg-paper shadow-lift">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <span className="eyebrow">Notifications</span>
                  {unread > 0 ? (
                    <button
                      type="button"
                      className="text-[11px] text-muted hover:text-ink"
                      onClick={async () => {
                        await api.post("/notifications/read-all");
                        void refetch();
                      }}
                    >
                      Mark all read
                    </button>
                  ) : null}
                </div>
                <div className="max-h-[340px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-[12px] text-muted">No notifications yet.</p>
                  ) : (
                    notifications.slice(0, 8).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          "block w-full border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-subtle",
                          !item.read && "bg-navy/[0.03]",
                        )}
                        onClick={async () => {
                          if (!item.read) {
                            await api.post(`/notifications/${item.id}/read`);
                            void refetch();
                          }
                          setNotificationsOpen(false);
                          if (item.action_route) navigate(item.action_route);
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[12.5px] font-medium text-ink">{item.title}</span>
                          <span className="mono shrink-0 text-[9.5px] uppercase text-muted">
                            {formatRelative(item.created_at)}
                          </span>
                        </div>
                        {item.body ? (
                          <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-muted">{item.body}</p>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setAccountOpen((open) => !open);
                setNotificationsOpen(false);
              }}
              className="flex h-8 items-center gap-2 rounded-sm border border-line px-2 text-muted transition-colors hover:text-ink"
              aria-label="Account menu"
            >
              <UserRound className="h-4 w-4" />
              <span className="mono hidden max-w-[110px] truncate text-[10.5px] uppercase tracking-[0.08em] lg:block">
                {user?.full_name || user?.email || "Account"}
              </span>
            </button>
            {accountOpen ? (
              <div className="absolute right-0 top-11 w-[240px] border border-line bg-paper p-1 shadow-lift">
                <div className="px-3 py-2">
                  <div className="text-[12.5px] text-ink">{user?.full_name || "Analyst"}</div>
                  <div className="truncate text-[11px] text-muted">{user?.email}</div>
                </div>
                <div className="rule my-1" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-muted hover:bg-subtle hover:text-ink"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
