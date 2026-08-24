import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-16">
      <div className="text-center">
        <Image
          src="/mascot-cutout.png"
          alt=""
          width={220}
          height={220}
          className="mx-auto h-auto w-40 select-none opacity-90 drop-shadow-[0_14px_22px_rgba(46,74,28,0.14)]"
        />
        <h1 className="mt-6 font-display text-4xl text-forest">Oops!</h1>
        <p className="mt-1 font-display text-xl text-forest">Page not found</p>
        <p className="mx-auto mt-3 max-w-sm text-sm text-body">
          The page you are looking for doesn&rsquo;t exist, or it may have moved.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full bg-forest px-5 text-sm font-medium text-cream hover:bg-forest-600"
          >
            Go back home
          </Link>
          <Link
            href="/store"
            className="inline-flex min-h-11 items-center rounded-full border border-forest/25 px-5 text-sm font-medium text-forest hover:bg-tint"
          >
            Browse cardamom
          </Link>
        </div>
      </div>
    </main>
  );
}
