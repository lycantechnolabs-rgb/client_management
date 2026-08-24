/**
 * The four stages of the scrubbed pod section.
 *
 * Kept out of the WebGL module on purpose: the flat fallback renders the same
 * copy, and it must not drag three.js into the bundle to do it.
 */
export const STAGES = [
  {
    label: "On the plant",
    title: "It starts as a panicle on the ground",
    text: "Cardamom fruits on runners at the base of the plant, in the shade, out of sight. Whether the crop sets at all is decided months earlier — by feeding, by shade, by what was sprayed and when.",
    metric: "40–45 days between picking rounds",
  },
  {
    label: "Picked",
    title: "Picked by hand, round after round",
    text: "Pods ripen unevenly, so the same block is picked six or seven times a season. Each round is a crew, a date, a green weight — logged on the estate before anyone leaves it.",
    metric: "6–7 rounds a season, per block",
  },
  {
    label: "Cured",
    title: "Cured slowly, or the colour is gone",
    text: "In the curing house the pods come down to about ten per cent moisture. Too hot and the green burns off; too slow and they mould. The temperature curve is the whole craft.",
    metric: "≈5 kg green to 1 kg cured",
  },
  {
    label: "Graded",
    title: "Graded, weighed, and priced honestly",
    text: "Sorted by size and colour into bold and lower grades. You see the split for your own estate — not a single number at the end of the season, but every round that made it.",
    metric: "8mm+ bold fetches the premium",
  },
] as const;
