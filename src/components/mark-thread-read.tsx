"use client";

import { useEffect, useRef } from "react";
import { markThreadRead } from "@/app/messages-actions";

/**
 * Marks a thread read once it has been opened.
 *
 * This runs from the client rather than during the page render, and that is not
 * a style choice: markThreadRead calls revalidatePath so the unread badge in the
 * shell updates, and revalidatePath throws when it is called while a component
 * is rendering. Doing it on the server produced a 500 on exactly the pages that
 * had something to mark — which is to say, every page a grower actually opened
 * with mail waiting.
 */
export function MarkThreadRead({ clientId }: { clientId: string }) {
  const done = useRef(false);

  useEffect(() => {
    // React runs effects twice in development; marking twice is harmless but
    // the second call is a wasted round trip.
    if (done.current) return;
    done.current = true;
    void markThreadRead(clientId);
  }, [clientId]);

  return null;
}
