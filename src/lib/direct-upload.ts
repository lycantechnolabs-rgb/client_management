import {
  completeUpload,
  requestUploadTicket,
} from "@/app/dashboard/uploads/direct-actions";

/**
 * Sending one file straight to storage from the browser.
 *
 * Three steps, and the middle one never touches this application's server:
 *
 *   1. ask for a ticket — a small request the server authorises;
 *   2. PUT the bytes to the address on the ticket;
 *   3. tell the server, which verifies what actually landed.
 *
 * XMLHttpRequest rather than fetch, for one reason: fetch cannot report upload
 * progress. A grower on a hill connection sending a two-minute video needs to
 * see it moving, or they will assume it has hung and start again — which is how
 * one slow upload becomes four.
 */

export type UploadProgress = {
  file: string;
  /** 0–100. */
  percent: number;
};

export type UploadOutcome =
  | { ok: true; file: string }
  | { ok: false; file: string; error: string };

function put(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);

    xhr.setRequestHeader("content-type", file.type);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true });
      } else if (xhr.status === 413) {
        resolve({ ok: false, error: "That file is larger than the limit." });
      } else {
        resolve({ ok: false, error: `Upload failed (${xhr.status}).` });
      }
    });

    xhr.addEventListener("error", () =>
      resolve({
        ok: false,
        error: "The connection dropped. Try again when you have signal.",
      }),
    );
    xhr.addEventListener("abort", () =>
      resolve({ ok: false, error: "Upload cancelled." }),
    );

    xhr.send(file);
  });
}

/**
 * Upload files one at a time.
 *
 * Sequential on purpose. Parallel uploads finish sooner on a good connection
 * and much later on a bad one, because several large transfers competing for a
 * thin uplink all slow down together and any one of them failing takes its
 * share of the bandwidth with it. One at a time also makes progress mean
 * something.
 */
export async function uploadFiles(
  files: File[],
  meta: { caption: string; category: string },
  onProgress: (p: UploadProgress) => void,
): Promise<UploadOutcome[]> {
  const results: UploadOutcome[] = [];

  for (const file of files) {
    onProgress({ file: file.name, percent: 0 });

    const ticket = await requestUploadTicket(file.name, file.type, file.size);
    if ("error" in ticket) {
      results.push({ ok: false, file: file.name, error: ticket.error });
      continue;
    }

    const sent = await put(ticket.url, ticket.headers, file, (percent) =>
      onProgress({ file: file.name, percent }),
    );
    if (!sent.ok) {
      results.push({ ok: false, file: file.name, error: sent.error });
      continue;
    }

    const done = await completeUpload(
      ticket.token,
      meta.caption,
      meta.category,
    );
    if (done.error) {
      results.push({ ok: false, file: file.name, error: done.error });
      continue;
    }

    onProgress({ file: file.name, percent: 100 });
    results.push({ ok: true, file: file.name });
  }

  return results;
}
