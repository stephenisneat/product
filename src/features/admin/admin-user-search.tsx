"use client";

import { useEffect, useState } from "react";
import { SearchIcon, XIcon } from "@/components/icons";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserAvatar } from "@/features/avatars/user-avatar";
import type { AdminUserSearchResult } from "@/features/admin/types";
import { cn } from "@/lib/utils";

export function AdminUserSearch({
  onSelect,
  excludeIds = [],
  disabled = false,
}: {
  onSelect: (user: AdminUserSearchResult) => void;
  excludeIds?: string[];
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<AdminUserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void (async () => {
        try {
          const res = await fetch(
            `/api/admin/users/search?q=${encodeURIComponent(trimmed)}`,
            { signal: controller.signal },
          );
          const body = (await res.json().catch(() => ({}))) as {
            users?: AdminUserSearchResult[];
            error?: string;
          };
          if (!res.ok) {
            throw new Error(body.error || "Search failed");
          }
          setResults(body.users ?? []);
        } catch (err) {
          if (controller.signal.aborted) return;
          setResults([]);
          setError(err instanceof Error ? err.message : "Search failed");
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed]);

  const exclude = new Set(excludeIds);
  const visible = results.filter((u) => !exclude.has(u.id));

  function pick(user: AdminUserSearchResult) {
    if (user.isPlatformAdmin) return;
    onSelect(user);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={<div className="relative w-full" />}
      >
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Search by name or email…"
          className="h-9 pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          aria-label="Search users"
          aria-expanded={open}
          aria-controls="admin-user-search-results"
          role="combobox"
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setQuery("");
              setOpen(true);
            }}
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-80 max-w-[calc(100vw-2rem)] gap-0 p-1"
        id="admin-user-search-results"
      >
        {trimmed.length < 2 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            Type at least 2 characters to search
          </p>
        ) : loading ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Searching…</p>
        ) : error ? (
          <p className="px-2 py-3 text-sm text-destructive">{error}</p>
        ) : visible.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            No matching users
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto" role="listbox">
            {visible.map((user) => {
              const alreadyAdmin = user.isPlatformAdmin;
              return (
                <li key={user.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    disabled={alreadyAdmin}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none",
                      alreadyAdmin
                        ? "cursor-default opacity-60"
                        : "hover:bg-accent hover:text-accent-foreground",
                    )}
                    onClick={() => pick(user)}
                  >
                    <UserAvatar
                      name={user.name}
                      email={user.email}
                      avatarUrl={user.avatarUrl}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {user.name || user.email || user.id}
                      </span>
                      {user.email ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      ) : null}
                    </span>
                    {alreadyAdmin ? (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        Admin
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
