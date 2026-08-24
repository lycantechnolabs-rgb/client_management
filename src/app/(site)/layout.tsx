import Link from "next/link";
import { CartProvider } from "@/components/cart";
import { SiteHeader } from "@/components/site-header";
import { ReadingProgress } from "@/components/scroll";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <div className="grain flex min-h-dvh flex-col">
        <ReadingProgress />
        <SiteHeader />
        <main className="flex-1">{children}</main>

        <footer className="leaf-mark contoured mt-20 border-t border-line bg-cream-deep">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-5">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-forest font-display text-[15px] leading-none text-cream">
                  A
                </span>
                <span className="font-display text-lg tracking-wide text-forest">
                  AELA
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
                  <Link href="/services" className="hover:text-forest">
                    Services
                  </Link>
                </li>
                <li>
                  <Link href="/how-it-works" className="hover:text-forest">
                    How it works
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-forest">
                    Client login
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-sm font-medium text-forest">Store</h2>
              <ul className="mt-3 space-y-2 text-sm text-body">
                <li>
                  <Link href="/store" className="hover:text-forest">
                    Buy cardamom
                  </Link>
                </li>
                <li>
                  <Link href="/orders/lookup" className="hover:text-forest">
                    Track an order
                  </Link>
                </li>
                <li>
                  <Link href="/quality" className="hover:text-forest">
                    Our grades
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-sm font-medium text-forest">Company</h2>
              <ul className="mt-3 space-y-2 text-sm text-body">
                <li>
                  <Link href="/about" className="hover:text-forest">
                    About us
                  </Link>
                </li>
                <li>
                  <Link href="/gallery" className="hover:text-forest">
                    Gallery
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-forest">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-line">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p>© {new Date().getFullYear()} AELA. Idukki, Kerala.</p>
              <p>
                Demo build by Lycan Technolabs — business name and branding
                pending.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
