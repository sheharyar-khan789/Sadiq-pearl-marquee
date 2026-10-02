"use client";

import { useId, useState } from "react";
import {
  SERVICE_CATEGORIES,
  type EventTypeConfig,
  type MenuConfig,
  type MenuItemConfig,
  type PackageConfig,
  type ServiceConfig,
} from "@/lib/config/business-config";
import { formatPKR } from "@/lib/booking/format";
import { NoticeLine } from "../BookingActions";
import ConfirmDialog from "../ConfirmDialog";
import { field, FieldError, labelCls, numOrNull, useSettingsSave } from "./SettingsForms";

type Section = "eventTypes" | "services" | "menus" | "packages";
type Entity = EventTypeConfig | ServiceConfig | MenuConfig | PackageConfig;

const NOUN: Record<Section, [string, string]> = {
  eventTypes: ["event type", "event types"],
  services: ["service", "services"],
  menus: ["menu", "menus"],
  packages: ["package", "packages"],
};

export function priceText(e: { pricingMode: string | null; price: number | null }): string {
  if (e.price === null || !e.pricingMode) return "Pricing pending";
  return e.pricingMode === "per_guest" ? `${formatPKR(e.price)} per guest` : `${formatPKR(e.price)} fixed`;
}

interface Draft {
  id: string;
  name: string;
  description: string;
  active: boolean;
  sortOrder: string;
  category: string;
  pricingMode: string;
  price: string;
  items: (Omit<MenuItemConfig, "sortOrder"> & { sortOrder: string })[];
  serviceIds: string[];
  menuId: string;
}

function toDraft(e: Entity | null, nextOrder: number): Draft {
  const x = (e ?? {}) as Partial<ServiceConfig & MenuConfig & PackageConfig>;
  return {
    id: "",
    name: x.name ?? "",
    description: x.description ?? "",
    active: x.active ?? true,
    sortOrder: String(x.sortOrder ?? nextOrder),
    category: x.category ?? "",
    pricingMode: x.pricingMode ?? "",
    price: x.price === null || x.price === undefined ? "" : String(x.price),
    items: (x.items ?? []).map((i) => ({ ...i, sortOrder: String(i.sortOrder) })),
    serviceIds: x.serviceIds ?? [],
    menuId: x.menuId ?? "",
  };
}

/** List + add/edit + activate/deactivate for one entity section. Nothing is ever deleted. */
export default function EntityManager({
  section,
  items,
  services = [],
  menus = [],
}: {
  section: Section;
  items: Entity[];
  services?: ServiceConfig[];
  menus?: MenuConfig[];
}) {
  const uid = useId();
  const [one, many] = NOUN[section];
  const { busy, notice, errors, save } = useSettingsSave();
  const [editing, setEditing] = useState<Entity | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft(null, items.length + 1));
  const [toggle, setToggle] = useState<Entity | null>(null);
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const priced = section !== "eventTypes";

  const open = (e: Entity | "new") => {
    setEditing(e);
    setDraft(toDraft(e === "new" ? null : e, items.length + 1));
  };
  const set = (k: keyof Draft) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setDraft({ ...draft, [k]: ev.target.type === "checkbox" ? (ev.target as HTMLInputElement).checked : ev.target.value });

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const data: Record<string, unknown> = {
      name: draft.name,
      description: draft.description,
      active: draft.active,
      sortOrder: numOrNull(draft.sortOrder),
    };
    if (editing === "new" && draft.id.trim()) data.id = draft.id.trim();
    if (priced) {
      data.pricingMode = draft.pricingMode || null;
      data.price = numOrNull(draft.price);
    }
    if (section === "services") data.category = draft.category;
    if (section === "menus") {
      data.items = draft.items.map((i, idx) => ({
        ...(i.id ? { id: i.id } : {}),
        name: i.name,
        description: i.description,
        category: i.category,
        active: i.active,
        sortOrder: numOrNull(i.sortOrder) ?? idx + 1,
      }));
    }
    if (section === "packages") {
      data.serviceIds = draft.serviceIds;
      data.menuId = draft.menuId || null;
    }
    const ok = await save(
      editing === "new"
        ? { section, op: "create", data }
        : { section, op: "update", id: (editing as Entity).id, expectedVersion: (editing as Entity).version, data },
      editing === "new" ? `The ${one} was added.` : `The ${one} was saved. Existing bookings keep their stored details.`
    );
    if (ok) setEditing(null);
  };

  const confirmToggle = async () => {
    if (!toggle) return;
    await save(
      { section, op: "setActive", id: toggle.id, expectedVersion: toggle.version, data: { active: !toggle.active } },
      toggle.active ? `Deactivated. It can't be chosen for new bookings; existing bookings still show it.` : "Activated."
    );
    setToggle(null);
  };

  const summary = (e: Entity): string => {
    const parts: string[] = [];
    if (section === "services") {
      const s = e as ServiceConfig;
      parts.push(SERVICE_CATEGORIES.find((c) => c.id === s.category)?.label ?? s.category);
    }
    if (section === "menus") parts.push(`${(e as MenuConfig).items.length} item(s)`);
    if (section === "packages") {
      const p = e as PackageConfig;
      parts.push(`${p.serviceIds.length} service(s)`);
      if (p.menuId) parts.push(`menu: ${menus.find((m) => m.id === p.menuId)?.name ?? p.menuId}`);
    }
    if (priced) parts.push(priceText(e as ServiceConfig));
    return parts.join(" · ");
  };

  return (
    <div className="space-y-3">
      <NoticeLine notice={editing ? null : notice} />
      {section === "packages" && services.filter((s) => s.active).length === 0 && menus.filter((m) => m.active).length === 0 && (
        <p className="text-sm text-ink-muted">Packages combine services and a menu. Add services or menus first.</p>
      )}
      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong/60 px-4 py-6 text-center text-sm text-ink-muted">
          No {many} configured.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {sorted.map((e) => (
            <li key={e.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words font-semibold text-ink">
                  {e.name}{" "}
                  <span className={`ml-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${e.active ? "border-emerald-300 text-emerald-900" : "border-line-strong text-ink-muted"}`}>
                    {e.active ? "Active" : "Inactive"}
                  </span>
                </p>
                <p className="break-words text-xs text-ink-muted">
                  <span className="font-mono">{e.id}</span>
                  {summary(e) && ` · ${summary(e)}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => open(e)} className="btn btn-outline btn-sm">
                  Edit
                </button>
                <button type="button" onClick={() => setToggle(e)} className="btn btn-outline btn-sm">
                  {e.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing === null ? (
        <button type="button" onClick={() => open("new")} className="btn btn-primary btn-sm">
          Add {one}
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-gold-container/50 bg-surface p-3" aria-label={editing === "new" ? `Add ${one}` : `Edit ${one}`}>
          <p className="text-sm font-semibold text-ink">{editing === "new" ? `Add ${one}` : `Edit ${one}: ${(editing as Entity).name}`}</p>
          <NoticeLine notice={notice} />
          <FieldError id={`${uid}-g`} message={errors._} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-name`} className={labelCls}>Name</label>
              <input id={`${uid}-name`} value={draft.name} maxLength={80} onChange={set("name")} className={field} aria-invalid={!!errors.name || undefined} />
              <FieldError id={`${uid}-name-e`} message={errors.name} />
            </div>
            {editing === "new" && (
              <div>
                <label htmlFor={`${uid}-id`} className={labelCls}>Stable ID (optional)</label>
                <input id={`${uid}-id`} value={draft.id} maxLength={40} onChange={set("id")} placeholder="made from the name" className={field} aria-invalid={!!errors.id || undefined} />
                <FieldError id={`${uid}-id-e`} message={errors.id} />
              </div>
            )}
            <div className="sm:col-span-2">
              <label htmlFor={`${uid}-desc`} className={labelCls}>Description</label>
              <textarea id={`${uid}-desc`} rows={2} maxLength={500} value={draft.description} onChange={set("description")} className={`${field} h-auto py-2`} />
              <FieldError id={`${uid}-desc-e`} message={errors.description} />
            </div>
            {section === "services" && (
              <div>
                <label htmlFor={`${uid}-cat`} className={labelCls}>Category</label>
                <select id={`${uid}-cat`} value={draft.category} onChange={set("category")} className={field} aria-invalid={!!errors.category || undefined}>
                  <option value="">Choose…</option>
                  {SERVICE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <FieldError id={`${uid}-cat-e`} message={errors.category} />
              </div>
            )}
            {priced && (
              <>
                <div>
                  <label htmlFor={`${uid}-pm`} className={labelCls}>Pricing</label>
                  <select id={`${uid}-pm`} value={draft.pricingMode} onChange={set("pricingMode")} className={field} aria-invalid={!!errors.pricingMode || undefined}>
                    <option value="">Not configured (pricing pending)</option>
                    <option value="fixed">Fixed amount per booking</option>
                    <option value="per_guest">Amount per guest</option>
                  </select>
                  <FieldError id={`${uid}-pm-e`} message={errors.pricingMode} />
                </div>
                <div>
                  <label htmlFor={`${uid}-price`} className={labelCls}>Price (PKR, whole rupees)</label>
                  <input id={`${uid}-price`} type="number" inputMode="numeric" min={0} value={draft.price} onChange={set("price")} className={field} aria-invalid={!!errors.price || undefined} />
                  <FieldError id={`${uid}-price-e`} message={errors.price} />
                </div>
              </>
            )}
            <div>
              <label htmlFor={`${uid}-order`} className={labelCls}>Order</label>
              <input id={`${uid}-order`} type="number" inputMode="numeric" min={0} value={draft.sortOrder} onChange={set("sortOrder")} className={field} />
            </div>
            <label className="flex min-h-[44px] items-center gap-2 self-end text-sm">
              <input type="checkbox" checked={draft.active} onChange={set("active")} className="h-5 w-5 accent-[#17120f]" />
              Active (can be chosen for new bookings)
            </label>
          </div>

          {section === "packages" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <fieldset>
                <legend className={labelCls}>Included services</legend>
                {services.filter((s) => s.active).length === 0 ? (
                  <p className="text-xs text-ink-muted">No active services.</p>
                ) : (
                  services
                    .filter((s) => s.active || draft.serviceIds.includes(s.id))
                    .map((s) => (
                      <label key={s.id} className="flex min-h-[40px] items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.serviceIds.includes(s.id)}
                          onChange={() =>
                            setDraft({ ...draft, serviceIds: draft.serviceIds.includes(s.id) ? draft.serviceIds.filter((x) => x !== s.id) : [...draft.serviceIds, s.id] })
                          }
                          className="h-5 w-5 accent-[#17120f]"
                        />
                        {s.name}
                      </label>
                    ))
                )}
                <FieldError id={`${uid}-svc-e`} message={errors.serviceIds} />
              </fieldset>
              <div>
                <label htmlFor={`${uid}-menu`} className={labelCls}>Included menu</label>
                <select id={`${uid}-menu`} value={draft.menuId} onChange={set("menuId")} className={field} aria-invalid={!!errors.menuId || undefined}>
                  <option value="">No menu</option>
                  {menus.filter((m) => m.active || m.id === draft.menuId).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <FieldError id={`${uid}-menu-e`} message={errors.menuId} />
              </div>
            </div>
          )}

          {section === "menus" && (
            <fieldset className="space-y-2">
              <legend className={labelCls}>Menu items</legend>
              {draft.items.length === 0 && <p className="text-xs text-ink-muted">No items yet.</p>}
              {draft.items.map((it, idx) => (
                <div key={idx} className="grid gap-2 rounded-lg border border-line p-2 sm:grid-cols-[1fr_10rem_auto_auto]">
                  <div>
                    <label htmlFor={`${uid}-it-${idx}`} className="sr-only">Item {idx + 1} name</label>
                    <input
                      id={`${uid}-it-${idx}`}
                      value={it.name}
                      maxLength={120}
                      placeholder="Dish name"
                      onChange={(e) => setDraft({ ...draft, items: draft.items.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)) })}
                      className={field}
                      aria-invalid={!!errors[`items.${idx}`] || undefined}
                    />
                    <FieldError id={`${uid}-it-${idx}-e`} message={errors[`items.${idx}`]} />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-itc-${idx}`} className="sr-only">Item {idx + 1} category</label>
                    <input
                      id={`${uid}-itc-${idx}`}
                      value={it.category}
                      maxLength={60}
                      placeholder="Category (optional)"
                      onChange={(e) => setDraft({ ...draft, items: draft.items.map((x, i) => (i === idx ? { ...x, category: e.target.value } : x)) })}
                      className={field}
                    />
                  </div>
                  <label className="flex min-h-[44px] items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={it.active}
                      onChange={(e) => setDraft({ ...draft, items: draft.items.map((x, i) => (i === idx ? { ...x, active: e.target.checked } : x)) })}
                      className="h-5 w-5 accent-[#17120f]"
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) })}
                    className="btn btn-outline btn-sm"
                    aria-label={`Remove item ${idx + 1}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <FieldError id={`${uid}-items-e`} message={errors.items} />
              <button
                type="button"
                onClick={() =>
                  setDraft({ ...draft, items: [...draft.items, { id: "", name: "", description: "", category: "", active: true, sortOrder: String(draft.items.length + 1) }] })
                }
                className="btn btn-outline btn-sm"
              >
                Add item
              </button>
            </fieldset>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} aria-busy={busy || undefined} className="btn btn-primary btn-sm">
              {busy ? "Saving…" : editing === "new" ? `Add ${one}` : "Save changes"}
            </button>
            <button type="button" onClick={() => setEditing(null)} disabled={busy} className="btn btn-outline btn-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={toggle !== null}
        title={toggle?.active ? `Deactivate "${toggle?.name}"?` : `Activate "${toggle?.name}"?`}
        confirmLabel={toggle?.active ? "Deactivate" : "Activate"}
        danger={toggle?.active}
        busy={busy}
        onConfirm={confirmToggle}
        onClose={() => setToggle(null)}
      >
        <p>
          {toggle?.active
            ? "It will no longer be offered for new bookings. Existing bookings keep their stored details. Nothing is deleted."
            : "It will be offered again for new bookings."}
        </p>
      </ConfirmDialog>
    </div>
  );
}
