"use client";

import { useEffect, useState } from "react";

export type EventTypesState =
  | { status: "loading" }
  | { status: "ready"; eventTypes: { id: string; name: string }[] }
  | { status: "error" };

// One request per page load, shared by every inquiry form on the page.
let request: Promise<{ id: string; name: string }[]> | null = null;

function load() {
  request ??= fetch("/api/public/event-types", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (!Array.isArray(data.eventTypes)) throw new Error("bad response");
      return data.eventTypes as { id: string; name: string }[];
    })
    .catch((error) => {
      request = null; // allow a retry on the next mount
      throw error;
    });
  return request;
}

/** Active event types from the stored business configuration (same list as bookings). */
export function usePublicEventTypes(): EventTypesState {
  const [state, setState] = useState<EventTypesState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    load().then(
      (eventTypes) => alive && setState({ status: "ready", eventTypes }),
      () => alive && setState({ status: "error" })
    );
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
