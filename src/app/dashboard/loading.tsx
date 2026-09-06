import { Loader2 } from "lucide-react";

/**
 * Shown the instant a navigation starts, while the target page's server
 * component is still fetching its data. Without this file, Next has nothing
 * to render until that fetch finishes — the screen just sits there looking
 * unresponsive, which is what made every tab switch feel slow regardless of
 * how fast the data actually came back.
 */
export default function DashboardLoading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Loader2 className="size-6 animate-spin text-moss" />
    </div>
  );
}
