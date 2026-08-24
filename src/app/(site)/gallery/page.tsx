import Image from "next/image";

export const metadata = {
  title: "Gallery",
  description:
    "The estate through the season — planting, spraying, harvest and curing.",
};

const SHOTS = [
  { n: 1, caption: "The estate block, early morning" },
  { n: 4, caption: "Harvest — picking round" },
  { n: 5, caption: "Fresh capsules before curing" },
  { n: 6, caption: "The curing house" },
  { n: 2, caption: "Fertilizer round" },
  { n: 9, caption: "Drying trays" },
  { n: 10, caption: "Shade trees, regulated before the monsoon" },
  { n: 3, caption: "Checking the panicles" },
  { n: 12, caption: "Sprinkler line during a dry spell" },
];

export default function GalleryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="max-w-xl">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-moss">
          Gallery
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-forest sm:text-5xl">
          The estate, through a season
        </h1>
        <p className="mt-4 leading-relaxed text-body">
          Cardamom is a year-round crop with a long season. These are the parts
          of it most people never see.
        </p>
      </header>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SHOTS.map((shot) => (
          <figure
            key={shot.n}
            className="group overflow-hidden rounded-[--radius-card] border border-line bg-surface"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-tint">
              <Image
                src={`/uploads/estate-${shot.n}.svg`}
                alt={shot.caption}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            </div>
            <figcaption className="px-4 py-3 text-sm text-body">
              {shot.caption}
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted">
        Illustrated, not photographed — each scene is drawn from the work it
        describes. Photography from the estate will replace it.
      </p>
    </div>
  );
}
