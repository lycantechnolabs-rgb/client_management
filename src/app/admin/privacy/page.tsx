import { requireAdmin } from "@/lib/session";
import { Card, CardBody } from "@/components/ui";
import { GRIEVANCE_OFFICER, NOTICE_VERSION } from "@/lib/dpdp";
import { loadPrivacyDashboard } from "@/lib/dpdp-admin";
import { NotificationOutbox } from "./notification-outbox";
import {
  BreachRegister,
  ErasureTool,
  RequestQueue,
  RetentionCard,
} from "./privacy-admin";

export const metadata = { title: "Data requests" };

export default async function AdminPrivacyPage() {
  await requireAdmin();

  const { requests, breaches, due } = await loadPrivacyDashboard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl text-forest lg:hidden">
          Data requests
        </h1>
        <p className="mt-1 text-sm text-body lg:mt-0">
          Everything the Digital Personal Data Protection Act puts on us, in one
          place.
        </p>
      </div>

      <RequestQueue requests={requests} />

      <div className="grid gap-4 lg:grid-cols-2">
        <RetentionCard due={due} />
        <ErasureTool />
      </div>

      <NotificationOutbox />

      <BreachRegister breaches={breaches} />

      <Card>
        <CardBody className="space-y-1.5 text-sm">
          <p className="font-medium text-forest">Who answers for this</p>
          <p className="text-body">
            {GRIEVANCE_OFFICER.name} — {GRIEVANCE_OFFICER.role}.{" "}
            {GRIEVANCE_OFFICER.email} · {GRIEVANCE_OFFICER.phoneDisplay}
          </p>
          <p className="text-xs text-muted">
            The published notice is version {NOTICE_VERSION}. Change what the
            software does with personal data and the notice has to move first —
            both are generated from src/lib/dpdp.ts.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
