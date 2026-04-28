import { Button } from '@/ui/Button';
import { useDataExport, useErasureRequest, useMarketingPrefs } from './api';

export function PrivacyTab() {
  const exportData = useDataExport();
  const erasure = useErasureRequest();
  const prefs = useMarketingPrefs();

  return (
    <div className="grid gap-6">
      <section>
        <h2 className="text-lg font-medium">Your data (GDPR Art. 15 / 20)</h2>
        <p className="text-sm text-acme-gray">
          Download a portable archive of every record we hold about you.
        </p>
        <Button onClick={() => exportData.mutate()} disabled={exportData.isPending} className="mt-2">
          {exportData.isPending ? 'Preparing…' : 'Request export'}
        </Button>
        {exportData.data ? (
          <p className="mt-2 text-sm">
            Download:{' '}
            <a className="text-acme-blue underline" href={exportData.data.downloadUrl}>
              link
            </a>
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="text-lg font-medium">Erasure (GDPR Art. 17)</h2>
        <p className="text-sm text-acme-gray">
          Initiates a 30-day workflow. We retain order data only as required by law (tax).
        </p>
        <Button variant="danger" onClick={() => erasure.mutate()} disabled={erasure.isPending} className="mt-2">
          Request erasure
        </Button>
        {erasure.data ? (
          <p className="mt-2 text-sm">Ticket {erasure.data.ticketId} — status: {erasure.data.status}</p>
        ) : null}
      </section>

      <section>
        <h2 className="text-lg font-medium">Marketing preferences (GDPR Art. 21)</h2>
        <div className="mt-2 flex gap-2">
          <Button onClick={() => prefs.mutate({ optIn: true })} variant="secondary">
            Opt in
          </Button>
          <Button onClick={() => prefs.mutate({ optIn: false })} variant="secondary">
            Opt out
          </Button>
        </div>
      </section>
    </div>
  );
}
