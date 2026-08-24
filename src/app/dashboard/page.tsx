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

export default async function DashboardHome() {
  const user = await requireClient();
  const [{ plots, recent, driedTotal, saleTotal, spend, activityCount }, rounds] =
    await Promise.all([
      getClientOverview(user.clientId),
      getRoundBoard(user.clientId),
    ]);

  const lastVisit = recent[0]?.date;

  return (
    <div className="space-y-7">
      {/* What a grower wants first: when was he last here, and what did it cost */}
      <section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            tone="forest"
            label="Cardamom dried"
            value={kg(driedTotal)}
            sub="this season"
          />
          <StatTile
            label="Sale value"
            value={money(saleTotal)}
            sub="from harvests logged"
          />
          <StatTile
            label="Spent on estate"
            value={money(spend.total)}
            sub={`${money(spend.labour)} labour · ${money(spend.material)} inputs`}
          />
          <StatTile
            label="Last visit"
            value={lastVisit ? relativeDays(lastVisit) : "—"}
            sub={`${activityCount} jobs recorded`}
          />
        </div>
      </section>

      {/* Where each estate sits in the 45-day picking round */}
      {rounds.length > 0 ? (
        <RoundBoard rows={rounds} showClient={false} />
      ) : null}

      {plots.length > 0 ? (
        <section>
          <SectionHeading title="Your estates" />
          <div className="grid gap-3 sm:grid-cols-2">
            {plots.map((plot) => (
              <Card key={plot.id}>
                <CardBody className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base text-forest">
                      {plot.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {[
                        plot.location,
                        plot.areaAcres ? `${plot.areaAcres} acres` : null,
                        plot.plants ? `${plot.plants.toLocaleString("en-IN")} plants` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/activities?plot=${plot.id}`}
                    className="shrink-0 text-xs font-medium text-moss hover:underline"
                  >
                    View work
                  </Link>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeading
          title="Recent work"
          action={
            <Link
              href="/dashboard/activities"
              className="inline-flex items-center gap-1 text-sm text-moss hover:underline"
            >
              See all <ArrowRight className="size-3.5" />
            </Link>
          }
        />

        {recent.length === 0 ? (
          <EmptyState
            title="Nothing recorded yet"
            description="When Jinto visits your estate, the work he does will appear here with photos."
          />
        ) : (
          <div className="space-y-3">
            {recent.map((activity) => (
              <ActivityCard
                key={activity.id}
                href={`/dashboard/activities/${activity.id}`}
                activity={activity}
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
                Something to ask?
              </p>
              <p className="mt-0.5 text-sm text-cream/70">
                Message Jinto directly on WhatsApp.
              </p>
            </div>
            <ButtonLink
              href="https://wa.me/918590657900"
              target="_blank"
              rel="noopener noreferrer"
              variant="soft"
              className="shrink-0"
            >
              <MessageCircle className="size-4" />
              WhatsApp
            </ButtonLink>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
