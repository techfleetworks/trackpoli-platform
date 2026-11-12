"use client";

import * as React from "react";

import { StatusTag } from "@/components/ui/status-tag";
import { roleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { AdminRow } from "./adminTypes";
import { AdminRowMenu, type AdminRowActions } from "./AdminRowMenu";
import { ADMIN_LIST } from "./messages";

// The Admin-management list table (TP1-10). A semantic <table> so screen readers get the header/row/cell
// relationships for free (universal-accessibility-wcag); scope="col" headers label every column. Dates are
// formatted with Intl; a never-signed-in admin shows "Never". The row ⋯ menu carries the actions.

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

function fmtLastSignIn(iso: string | null): string {
  if (!iso) return ADMIN_LIST.neverSignedIn;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d);
}

const bodyMedium =
  "text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)]";
const labelMedium =
  "text-[length:var(--md-label-medium-size)] font-medium leading-[var(--md-label-medium-line)] tracking-[var(--md-label-medium-tracking)]";

export function AdminTable({ admins, actions }: { admins: AdminRow[]; actions: AdminRowActions }) {
  const cols = ADMIN_LIST.columns;
  const th = cn("px-4 py-3 text-left whitespace-nowrap text-muted-foreground", labelMedium);
  const td = cn("px-4 py-3 align-middle", bodyMedium, "text-foreground");
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={th}>
              {cols.name}
            </th>
            <th scope="col" className={th}>
              {cols.role}
            </th>
            <th scope="col" className={th}>
              {cols.status}
            </th>
            <th scope="col" className={th}>
              {cols.lastSignIn}
            </th>
            <th scope="col" className={th}>
              {cols.added}
            </th>
            <th scope="col" className={cn(th, "text-right")}>
              <span className="sr-only">{cols.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {admins.map((admin) => (
            <tr key={admin.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              <td className={td}>
                <div className="font-medium text-foreground">{admin.displayName}</div>
                <div className="text-muted-foreground">{admin.email}</div>
              </td>
              <td className={cn(td, "whitespace-nowrap")}>{roleLabel(admin.role)}</td>
              <td className={td}>
                <StatusTag status={admin.status} />
              </td>
              <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>
                {fmtLastSignIn(admin.lastSignInAt)}
              </td>
              <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{fmtDate(admin.createdAt)}</td>
              <td className={cn(td, "text-right")}>
                <AdminRowMenu admin={admin} actions={actions} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
