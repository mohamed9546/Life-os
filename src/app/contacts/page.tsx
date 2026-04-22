import { ContactsDashboard } from "@/features/contacts/contacts-dashboard";
import { ExportButton } from "@/components/export-button";

export default function ContactsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Contacts</h1>
          <p className="text-sm text-text-tertiary mt-1">Networking contacts and relationship tracker.</p>
        </div>
        <ExportButton module="contacts" />
      </div>
      <ContactsDashboard />
    </div>
  );
}
