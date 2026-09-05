import Link from "next/link";
import { CartProvider } from "@/components/cart";
import { SiteHeader } from "@/components/site-header";
import { ReadingProgress } from "@/components/scroll";
import { getContent } from "@/lib/content";
import { Announcement } from "@/components/announcement";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const c = await getContent();

  return (
    <CartProvider>
      <div className="grain flex min-h-dvh flex-col">
        <ReadingProgress />
        <Announcement text={c.announcement} />
        <SiteHeader businessName={c.business_name} />
        <main className="flex-1">{children}</main>

        <footer className="leaf-mark contoured mt-20 border-t border-line bg-cream-deep">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-5">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-forest font-display text-[15px] leading-none text-cream">
                  A
                </span>
                <span className="font-display text-lg tracking-wide text-forest">
                  {c.business_name}
                </span>
              </div>
              <p className="mt-3 max-w-sm text-sm text-body">
                Cardamom estate management in the hills of Idukki — run for
                growers, recorded in the open, with every day&apos;s work visible
                to the owner. We sell our own harvest too.
              </p>
            </div>

            <div>
              <h2 className="text-sm font-medium text-forest">Growers</h2>
              <ul className="mt-3 space-y-2 text-sm text-body">
                <li>
                  <Link href="/services" className="inline-block py-1 hover:text-forest">
                    Services
                  </Link>
                </li>
                <li>
                  <Link href="/how-it-works" className="inline-block py-1 hover:text-forest">
                    How it works
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="inline-block py-1 hover:text-forest">
                    Client login
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-sm font-medium text-forest">Store</h2>
              <ul className="mt-3 space-y-2 text-sm text-body">
                <li>
                  <Link href="/store" className="inline-block py-1 hover:text-forest">
                    Buy cardamom
                  </Link>
                </li>
                <li>
                  <Link href="/orders/lookup" className="inline-block py-1 hover:text-forest">
                    Track an order
                  </Link>
                </li>
                <li>
                  <Link href="/quality" className="inline-block py-1 hover:text-forest">
                    Our grades
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-sm font-medium text-forest">Company</h2>
              <ul className="mt-3 space-y-2 text-sm text-body">
                <li>
                  <Link href="/about" className="inline-block py-1 hover:text-forest">
                    About us
                  </Link>
                </li>
                <li>
                  <Link href="/gallery" className="inline-block py-1 hover:text-forest">
                    Gallery
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="inline-block py-1 hover:text-forest">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="inline-block py-1 hover:text-forest">
                    Privacy notice
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-line">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p>© {new Date().getFullYear()} {c.business_name}. Idukki, Kerala.</p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  href="/privacy"
                  className="inline-block py-1 underline hover:text-forest"
                >
                  Privacy
                </Link>
                <Link
                  href="/privacy/request"
                  className="inline-block py-1 underline hover:text-forest"
                >
                  Your data rights
                </Link>
                <span>Demo build by Lycan Technolabs.</span>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
