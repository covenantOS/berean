"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPassageRef, parsePassageRef, passageHref } from "@/lib/documents";
import { useCollection } from "@/lib/hooks";
import {
  PrayerFrequency,
  PrayerList,
  PrayerRequest,
  activeRequests,
  addRequest,
  answeredRequests,
  dueRequests,
  frequencyLabel,
  isRequestDue,
  markAnswered,
  markPrayed,
  prayerLists,
  removeRequest,
  restoreRequest,
  updateRequest,
} from "@/lib/prayers";

export default function PrayersPage() {
  const lists = useCollection(prayerLists);
  const [listTitle, setListTitle] = useState("");

  const due = dueRequests(lists);

  function addList(e: React.FormEvent) {
    e.preventDefault();
    if (!listTitle.trim()) return;
    prayerLists.create({ title: listTitle.trim(), requests: [] });
    setListTitle("");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-editorial mb-1 text-2xl font-bold">Prayer Lists</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted">
        The requests you carry before God, gathered into lists. A request waits daily, weekly, or
        as it comes; the record says plainly what is due today, and what has been answered stays
        to be read again. Nothing here leaves this device.
      </p>

      <form
        onSubmit={addList}
        className="mb-10 flex flex-wrap items-center gap-2 rounded-[4px] border border-rule bg-surface p-4"
      >
        <input
          value={listTitle}
          onChange={(e) => setListTitle(e.target.value)}
          placeholder="A list: family, the church, the lost…"
          aria-label="List title"
          className="min-w-0 flex-1 rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire"
        />
        <button
          type="submit"
          className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Begin a list
        </button>
      </form>

      {due.length > 0 && (
        <section className="mb-10 rounded-[4px] border border-rule bg-surface p-5">
          <h2 className="small-caps mb-3 text-sm text-muted">Appointed today</h2>
          <ul className="space-y-2">
            {due.map(({ list, request }) => (
              <li
                key={request.id}
                className="flex items-center justify-between gap-3 rounded-[4px] border border-rule bg-paper px-4 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">{request.title}</span>
                  <span className="small-caps ml-2 text-xs text-muted">
                    {list.title} · {frequencyLabel(request.frequency).toLowerCase()}
                  </span>
                </div>
                <button
                  onClick={() => markPrayed(list.id, request.id)}
                  className="shrink-0 rounded-[4px] border border-emerald px-3 py-1.5 text-xs font-medium text-emerald hover:bg-surface"
                >
                  Pray now
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lists.length === 0 ? (
        <p className="text-sm text-muted">
          No lists begun. Begin one above and carry the first request.
        </p>
      ) : (
        <div className="space-y-10">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- One list: its requests, its answered history ---------- */

const EMPTY_FORM = { title: "", details: "", category: "", tags: "", passage: "", frequency: "daily" as PrayerFrequency };

function ListCard({ list }: { list: PrayerList }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(list.title);

  const active = activeRequests(list);
  const answered = answeredRequests(list);

  function commitRename() {
    const title = draftName.trim();
    if (title && title !== list.title) prayerLists.update(list.id, { title });
    setRenaming(false);
  }

  function startEdit(r: PrayerRequest) {
    setEditingId(r.id);
    setForm({
      title: r.title,
      details: r.details ?? "",
      category: r.category ?? "",
      tags: r.tags.join(", "),
      passage: r.passage ?? "",
      frequency: r.frequency,
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const data = {
      title: form.title.trim(),
      details: form.details.trim() || undefined,
      category: form.category.trim() || undefined,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      passage: form.passage.trim() || undefined,
      frequency: form.frequency,
    };
    if (editingId) updateRequest(list.id, editingId, data);
    else addRequest(list.id, data);
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  const field =
    "rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-sapphire";

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        {renaming ? (
          <input
            autoFocus
            value={draftName}
            aria-label="List title"
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              // Reset before closing so the blur commit finds nothing to write.
              if (e.key === "Escape") {
                setDraftName(list.title);
                setRenaming(false);
              }
            }}
            className="font-editorial border border-rule bg-paper px-2 py-0.5 text-lg font-bold text-ink focus:outline focus:outline-2 focus:outline-sapphire"
          />
        ) : (
          <button
            onClick={() => {
              setDraftName(list.title);
              setRenaming(true);
            }}
            title={`Rename ${list.title}`}
            className="font-editorial text-lg font-bold text-ink hover:text-sapphire"
          >
            {list.title}
          </button>
        )}
        <span className="flex items-center gap-3">
          <span className="small-caps text-xs text-muted">
            {active.length} active · {answered.length} answered
          </span>
          <button
            onClick={() => prayerLists.remove(list.id)}
            className="text-xs text-ruby hover:underline"
          >
            Delete list
          </button>
        </span>
      </div>

      <form
        onSubmit={submit}
        className="mb-4 grid gap-2 rounded-[4px] border border-rule bg-surface p-4 sm:grid-cols-2"
      >
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="The request, in a sentence"
          aria-label="Request title"
          className={`${field} sm:col-span-2`}
        />
        <input
          value={form.details}
          onChange={(e) => setForm({ ...form, details: e.target.value })}
          placeholder="Details (optional)"
          aria-label="Details"
          className={`${field} sm:col-span-2`}
        />
        <input
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="Category (optional)"
          aria-label="Category"
          className={field}
        />
        <input
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder="Tags, comma separated (optional)"
          aria-label="Tags"
          className={field}
        />
        <input
          value={form.passage}
          onChange={(e) => setForm({ ...form, passage: e.target.value })}
          placeholder="Passage (optional), e.g. Colossians 1:9-12"
          aria-label="Passage"
          className={field}
        />
        <select
          value={form.frequency}
          onChange={(e) => setForm({ ...form, frequency: e.target.value as PrayerFrequency })}
          aria-label="Frequency"
          className={field}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="as-it-comes">As it comes</option>
        </select>
        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            className="rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {editingId ? "Save request" : "Carry this request"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
              className="rounded-[4px] border border-rule px-4 py-2 text-sm hover:bg-paper"
            >
              Set aside the edit
            </button>
          )}
        </div>
      </form>

      {active.length === 0 ? (
        <p className="text-sm text-muted">No requests carried here yet.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((r) => (
            <RequestRow key={r.id} list={list} request={r} onEdit={() => startEdit(r)} />
          ))}
        </ul>
      )}

      {answered.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted">
            {answered.length} answered request{answered.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 space-y-2">
            {answered.map((r) => (
              <li
                key={r.id}
                className="rounded-[4px] border border-rule bg-surface px-4 py-2.5 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-emerald">{r.title}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="small-caps text-xs text-muted">answered {r.answered!.date}</span>
                    <button
                      onClick={() => restoreRequest(list.id, r.id)}
                      title="Return this request to the active list"
                      className="text-xs text-muted hover:text-ink hover:underline"
                    >
                      Carry again
                    </button>
                  </span>
                </div>
                {r.answered!.note && <p className="mt-1 text-xs text-muted">{r.answered!.note}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/* ---------- One active request ---------- */

function RequestRow({
  list,
  request,
  onEdit,
}: {
  list: PrayerList;
  request: PrayerRequest;
  onEdit: () => void;
}) {
  const [answering, setAnswering] = useState(false);
  const [note, setNote] = useState("");

  const parsed = request.passage ? parsePassageRef(request.passage) : undefined;
  const due = isRequestDue(request);
  const lastPrayed = request.lastPrayedAt
    ? new Date(request.lastPrayedAt).toLocaleDateString()
    : "not yet prayed";

  return (
    <li className="rounded-[4px] border border-rule bg-surface px-4 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`font-medium ${due ? "text-ink" : "text-muted"}`}>{request.title}</span>
          {parsed ? (
            <Link
              href={passageHref(parsed)}
              className="ml-2 text-sapphire no-underline hover:underline"
            >
              {formatPassageRef(parsed)}
            </Link>
          ) : (
            request.passage && <span className="ml-2 text-muted">{request.passage}</span>
          )}
          <p className="small-caps mt-0.5 text-xs text-muted">
            {frequencyLabel(request.frequency).toLowerCase()}
            {request.category && ` · ${request.category}`}
            {request.tags.length > 0 && ` · ${request.tags.join(", ")}`}
            {` · last prayed ${lastPrayed}`}
            {due && " · due today"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => markPrayed(list.id, request.id)}
            className="rounded-[4px] border border-emerald px-3 py-1.5 text-xs font-medium text-emerald hover:bg-paper"
          >
            Pray now
          </button>
          <button
            onClick={onEdit}
            className="rounded-[4px] border border-rule px-3 py-1.5 text-xs hover:bg-paper"
          >
            Edit
          </button>
          <button
            onClick={() => setAnswering((v) => !v)}
            className="rounded-[4px] border border-rule px-3 py-1.5 text-xs hover:bg-paper"
          >
            Answered
          </button>
          <button
            onClick={() => removeRequest(list.id, request.id)}
            aria-label={`Remove ${request.title}`}
            className="rounded-[4px] border border-rule px-2 py-1.5 text-xs text-ruby hover:bg-paper"
          >
            ✕
          </button>
        </div>
      </div>
      {request.details && <p className="mt-1 text-xs leading-relaxed text-muted">{request.details}</p>}
      {answering && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            markAnswered(list.id, request.id, note.trim() || undefined);
          }}
          className="mt-2 flex gap-2"
        >
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How God answered (optional)"
            aria-label="Answer note"
            className="min-w-0 flex-1 rounded-[4px] border border-rule bg-paper px-3 py-1.5 text-xs focus:outline focus:outline-2 focus:outline-sapphire"
          />
          <button
            type="submit"
            className="rounded-[4px] bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Record the answer
          </button>
        </form>
      )}
    </li>
  );
}
