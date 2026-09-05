import Link from "next/link";
import { Mail, Phone, ShieldCheck } from "lucide-react";
import { ButtonLink, Card, CardBody } from "@/components/ui";
import {
  DATA_PROTECTION_BOARD,
  GRIEVANCE_OFFICER,
  NOTICE_VERSION,
  PURPOSES,
  REQUEST_KINDS,
  RESPONSE_DAYS,
  RETENTION,
} from "@/lib/dpdp";
import { getContent } from "@/lib/content";

export const metadata = {
  title: "Privacy notice",
  description:
    "What personal data AELA collects, why, how long it is kept, and how to exercise your rights under the Digital Personal Data Protection Act, 2023.",
};

/**
 * The s.5 notice.
 *
 * Everything on this page is rendered from src/lib/dpdp.ts rather than typed
 * out here. A privacy notice that is maintained separately from the code it
 * describes drifts within a release or two, and a notice that no longer matches
 * what the software does is worse than none — it is a false statement about
 * how someone's data is handled.
 */

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-2xl text-forest">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-body">{children}</div>
    </section>
  );
}

export default async function PrivacyPage() {
  /* The grievance route has to be *reachable*, so the phone and email come from
     the editable contact details rather than a constant that can drift. The
     identity of the fiduciary — the name and address — stays in code: that is
     the legal record, not a setting. Contact details changing is not a change
     to the notice's substance under s.5, so it does not bump NOTICE_VERSION and
     does not invalidate consent already given. */
  const c = await getContent();
  const officer = {
    ...GRIEVANCE_OFFICER,
    phone: c.contact_phone,
    phoneDisplay: c.contact_phone_display,
    email: c.contact_email,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header>
        <p className="inline-flex items-center gap-2 rounded-full border border-moss/25 bg-tint/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-moss">
          <ShieldCheck className="size-3.5" />
          Digital Personal Data Protection Act, 2023
        </p>
        <h1 className="mt-4 font-display text-4xl text-forest sm:text-5xl">
          What we do with your details
        </h1>
        <p className="mt-4 leading-relaxed text-body">
          This is the notice the Act requires us to give you. It is written to
          be read, not to be survived — if any part of it is unclear, call Jinto
          on{" "}
          <a
            href={`tel:${officer.phone}`}
            className="underline hover:text-forest"
          >
            {officer.phoneDisplay}
          </a>{" "}
          and ask.
        </p>
      </header>

      <Card className="mt-8 border-moss/30 bg-tint/25">
        <CardBody className="text-sm text-body">
          <p className="font-medium text-forest">A copy in Malayalam</p>
          <p className="mt-1.5">
            You are entitled to this notice in Malayalam. A written Malayalam
            version is being prepared with a translator — until it is published
            here, call{" "}
            <a
              href={`tel:${officer.phone}`}
              className="underline hover:text-forest"
            >
              {officer.phoneDisplay}
            </a>{" "}
            and Jinto will go through it with you in Malayalam.
          </p>
        </CardBody>
      </Card>

      <div className="mt-12 space-y-12">
        <Section id="who" title="Who holds your data">
          <p>
            {officer.name}, trading as AELA, {officer.address}.
            Under the Act we are the <em>Data Fiduciary</em> — the people who
            decide what is collected and why, and who are answerable for it.
          </p>
          <p>
            Two different groups of people appear in our records: growers whose
            estates we manage, and customers who buy cardamom from the shop. We
            also record the workers who work on an estate, so that days and
            wages can be accounted for.
          </p>
        </Section>

        <Section id="what" title="What we collect, and why">
          <p>
            Each purpose below is separate. We do not collect anything for one
            reason and quietly use it for another.
          </p>
          <div className="space-y-4 pt-1">
            {PURPOSES.map((purpose) => (
              <Card key={purpose.key}>
                <CardBody>
                  <h3 className="font-medium text-forest">{purpose.label}</h3>
                  <ul className="mt-2.5 space-y-1 text-sm text-body">
                    {purpose.data.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden="true" className="text-muted">
                          ·
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 border-t border-line-soft pt-3 text-xs text-muted">
                    {purpose.basis === "CONSENT"
                      ? "We ask your permission for this, and you can take it back."
                      : "We rely on a permitted use under the Act for this, rather than asking each time."}{" "}
                    <span className="opacity-80">{purpose.basisNote}</span>
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        </Section>

        <Section id="not" title="What we do not do">
          <ul className="space-y-2">
            {[
              "We do not sell your details, and we do not share them with anyone for their own marketing.",
              "We do not track you around the internet, and there are no advertising or analytics cookies on this site.",
              "We do not use your details to make automated decisions about you.",
              "We do not ask children for personal data, and the shop is not aimed at anyone under 18.",
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
                <span aria-hidden="true" className="text-moss">
                  —
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="keep" title="How long we keep it">
          <p>
            The Act says we must erase personal data once the purpose it was
            collected for is finished, unless the law requires us to keep it.
            Where a period below is long, it is because a statute sets it — not
            because we prefer to hold on.
          </p>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="py-2 pr-3 font-medium text-forest">What</th>
                  <th className="py-2 pr-3 font-medium text-forest">
                    How long
                  </th>
                  <th className="py-2 font-medium text-forest">Why</th>
                </tr>
              </thead>
              <tbody>
                {RETENTION.map((rule) => (
                  <tr key={rule.key} className="border-b border-line-soft">
                    <td className="py-2.5 pr-3 align-top text-body">
                      {rule.label}
                    </td>
                    <td className="py-2.5 pr-3 align-top whitespace-nowrap text-body">
                      {rule.days === null
                        ? "While needed"
                        : `${Math.round(rule.days / 365)} year${
                            Math.round(rule.days / 365) === 1 ? "" : "s"
                          }`}
                    </td>
                    <td className="py-2.5 align-top text-xs text-muted">
                      {rule.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="rights" title="What you can ask us to do">
          <p>
            These are your rights under the Act. Using any of them is free, and
            we answer within {RESPONSE_DAYS} days.
          </p>
          <div className="space-y-3 pt-1">
            {REQUEST_KINDS.map((right) => (
              <div
                key={right.key}
                className="rounded-xl border border-line-soft bg-surface p-4"
              >
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-forest">
                    {right.label}
                  </span>
                  <span className="text-xs text-muted">{right.section}</span>
                </p>
                <p className="mt-1 text-sm text-body">{right.blurb}</p>
              </div>
            ))}
          </div>
          <div className="pt-2">
            <ButtonLink href="/privacy/request">Make a request</ButtonLink>
          </div>
          <p className="text-sm text-muted">
            If you are a grower with a portal login, everything above is also in{" "}
            <Link href="/dashboard/privacy" className="underline hover:text-forest">
              your account
            </Link>
            , where you can download a copy of your data straight away.
          </p>
        </Section>

        <Section id="security" title="How it is kept safe">
          <p>
            Passwords are stored only as a one-way hash, so nobody here can read
            yours. Photographs and documents from an estate are stored outside
            the public part of the site and are served only after we check that
            the person asking owns them — a stranger with the exact filename
            still gets nothing.
          </p>
          <p>
            Every screen in the grower portal is scoped to the account that is
            signed in, and that scope comes from the session rather than from
            anything in the web address, so one grower cannot reach another
            grower&rsquo;s records by editing a URL.
          </p>
          <p>
            If a breach ever happens, the Act requires us to tell both the Data
            Protection Board and every person affected. We will, and we will not
            wait to be asked.
          </p>
        </Section>

        <Section id="complain" title="If we get it wrong">
          <p>
            Tell us first — it is the fastest way to fix it, and the Act expects
            you to have given us the chance.
          </p>
          <Card>
            <CardBody className="space-y-2 text-sm">
              <p className="font-medium text-forest">
                {officer.name}
              </p>
              <p className="text-muted">{officer.role}</p>
              <p className="flex items-center gap-2 pt-1">
                <Mail className="size-4 text-moss" />
                <a
                  href={`mailto:${officer.email}`}
                  className="underline hover:text-forest"
                >
                  {officer.email}
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-moss" />
                <a
                  href={`tel:${officer.phone}`}
                  className="underline hover:text-forest"
                >
                  {officer.phoneDisplay}
                </a>
              </p>
            </CardBody>
          </Card>
          <p>
            If we do not sort it out, you can complain to the{" "}
            <strong className="font-medium text-forest">
              {DATA_PROTECTION_BOARD.name}
            </strong>
            . {DATA_PROTECTION_BOARD.note}
          </p>
        </Section>

        <Section id="changes" title="Changes to this notice">
          <p>
            When we change what we do with your data, this notice changes first
            and we record which version you were shown when you agreed to
            anything.
          </p>
          <p className="text-sm text-muted">
            This is version <strong>{NOTICE_VERSION}</strong>.
          </p>
        </Section>
      </div>
    </div>
  );
}
