import { RequestForm } from "./request-form";

export const metadata = {
  title: "Ask us about your data",
  description:
    "Request a copy of your personal data, ask for a correction or erasure, nominate someone, or raise a grievance under the Digital Personal Data Protection Act, 2023.",
};

export default function DataRequestPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <RequestForm />
    </div>
  );
}
