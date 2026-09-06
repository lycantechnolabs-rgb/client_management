import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { requireClient } from "@/lib/session";
import { getClientOverview, getRoundBoard } from "@/lib/queries";
import { RoundBoard } from "@/components/round-board";
import { ActivityCard } from "@/components/activity-card";
import {
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  SectionHeading,
  StatTile,
} from "@/components/ui";
import { kg, money, relativeDays } from "@/lib/utils";
import { getContent } from "@/lib/content";
import { getI18n } from "@/lib/i18n";
import { translateActivities } from "@/lib/translate/activities";

export default async function DashboardHome() {
  // None of these three depend on each other — each is its own round trip
  // to the database, so run them together rather than one after another.
  const [c, { locale, t }, user] = await Promise.all([
    getContent(),
    getI18n(),
    requireClient(),
  ]);
  const [{ plots, recent, driedTotal, saleTotal, spend, activityCount }, rounds] =
    await Promise.all([
      getClientOverview(user.clientId),
      getRoundBoard(user.clientId),
    ]);

  // Jinto writes these in English; a grower who reads only Malayalam cannot
  // read the note about their own estate. Cached, so this is one call the first
  // time and none afterwards. See src/lib/translate.
  const shown = await translateActivities(recent, locale);

  const lastVisit = recent[0]?.date;

  return (
    <div className="space-y-7">
      {/* What a grower wants first: when was he last here, and what did it cost */}
      <section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            tone="forest"
            label={t("home.cardamomDried")}
            value={kg(driedTotal)}
            sub={t("home.thisSeason")}
          />
          <StatTile
            tone="glass"
            label={t("home.saleValue")}
            value={money(saleTotal)}
            sub={t("home.fromHarvests")}
          />
          <StatTile
            tone="glass"
            label={t("home.spentOnEstate")}
            value={money(spend.total)}
            sub={`${money(spend.labour)} ${t("home.labour")} · ${money(spend.material)} ${t("home.inputs")}`}
          />
          <StatTile
            tone="glass"
            label={t("home.lastVisit")}
            value={lastVisit ? relativeDays(lastVisit, t) : "—"}
            sub={`${activityCount} ${t("home.jobsRecorded")}`}
          />
        </div>
      </section>

      {/* Where each estate sits in the 45-day picking round */}
      {rounds.length > 0 ? (
        <RoundBoard
          rows={rounds}
          showClient={false}
          t={t}
          locale={locale}
          variant="glass"
          getHref={(row) => `/dashboard/activities?plot=${row.plotId}`}
        />
      ) : null}

      {plots.length > 0 ? (
        <section>
          <SectionHeading title={t("home.yourEstates")} />
          <div className="grid gap-3 sm:grid-cols-2">
            {plots.map((plot) => (
              <Card key={plot.id} variant="glass">
                <CardBody className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base text-forest">
                      {plot.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {[
                        plot.location,
                        plot.areaAcres ? `${plot.areaAcres} ${t("home.acres")}` : null,
                        plot.plants ? `${plot.plants.toLocaleString("en-IN")} ${t("home.plants")}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/activities?plot=${plot.id}`}
                    className="inline-flex min-h-11 shrink-0 items-center text-xs font-medium text-moss hover:underline"
                  >
                    {t("home.viewWork")}
                  </Link>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeading
          title={t("home.recentWork")}
          action={
            <Link
              href="/dashboard/activities"
              className="inline-flex min-h-11 items-center gap-1 text-sm text-moss hover:underline"
            >
              {t("home.seeAll")} <ArrowRight className="size-3.5" />
            </Link>
          }
        />

        {recent.length === 0 ? (
          <EmptyState
            title={t("home.noWorkYet")}
            description={t("home.noWorkYetBody")}
            variant="glass"
          />
        ) : (
          <div className="space-y-3">
            {shown.map((activity) => (
              <ActivityCard
                t={t}
                locale={locale}
                key={activity.id}
                href={`/dashboard/activities/${activity.id}`}
                activity={activity}
                variant="glass"
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <Card className="border-forest bg-forest">
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-lg text-cream">
                {t("home.somethingToAsk")}
              </p>
              <p className="mt-0.5 text-sm text-cream/70">
                {t("home.messageOnWhatsapp")}
              </p>
            </div>
            <ButtonLink
              href={`https://wa.me/${c.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="soft"
              className="shrink-0"
            >
              <MessageCircle className="size-4" />
              {t("home.whatsapp")}
            </ButtonLink>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
