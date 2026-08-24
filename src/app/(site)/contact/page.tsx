import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Card, CardBody } from "@/components/ui";
import { ContactForm } from "./contact-form";

export const metadata = {
  title: "Contact",
  description:
    "Get in touch about buying cardamom, or about having your estate managed.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="max-w-xl">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-moss">
          Contact
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-forest sm:text-5xl">
          Get in touch
        </h1>
        <p className="mt-4 leading-relaxed text-body">
          Whether you want to buy cardamom, ask about wholesale quantities, or
          talk about having your estate managed — a message or a call works.
        </p>
      </header>

      <div className="mt-10 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ContactForm />
        </div>

        <div className="space-y-3 lg:col-span-2">
          <Card>
            <CardBody className="space-y-4">
              <a
                href="tel:8590657900"
                className="flex items-start gap-3 hover:text-forest"
              >
                <Phone className="mt-0.5 size-5 shrink-0 text-moss" />
                <span>
                  <span className="block text-sm font-medium text-forest">
                    Phone
                  </span>
                  <span className="text-sm text-body">8590 657900</span>
                </span>
              </a>

              <a
                href="https://wa.me/918590657900"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 hover:text-forest"
              >
                <MessageCircle className="mt-0.5 size-5 shrink-0 text-moss" />
                <span>
                  <span className="block text-sm font-medium text-forest">
                    WhatsApp
                  </span>
                  <span className="text-sm text-body">
                    Usually the fastest way
                  </span>
                </span>
              </a>

              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 size-5 shrink-0 text-moss" />
                <span>
                  <span className="block text-sm font-medium text-forest">
                    Email
                  </span>
                  <span className="text-sm text-body">
                    hello@aela.co.in
                  </span>
                </span>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-moss" />
                <span>
                  <span className="block text-sm font-medium text-forest">
                    Where we are
                  </span>
                  <span className="text-sm text-body">
                    Vandanmedu, Idukki
                    <br />
                    Kerala 685551
                  </span>
                </span>
              </div>
            </CardBody>
          </Card>

          <Card className="border-forest bg-forest">
            <CardBody>
              <p className="font-display text-lg text-cream">
                Already a client?
              </p>
              <p className="mt-1 text-sm text-cream/70">
                Sign in to see the latest from your estate.
              </p>
              <a
                href="/login"
                className="mt-4 inline-flex min-h-11 items-center rounded-full bg-cream px-5 text-sm font-medium text-forest hover:bg-tint"
              >
                Client login
              </a>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
