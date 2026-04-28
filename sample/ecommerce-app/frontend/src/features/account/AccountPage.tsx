import { useState } from 'react';
import { OrdersTab } from './OrdersTab';
import { PrivacyTab } from './PrivacyTab';
import { useProfile } from './api';
import { Spinner } from '@/ui/Spinner';

type Tab = 'profile' | 'orders' | 'privacy';

export function AccountPage() {
  const [tab, setTab] = useState<Tab>('profile');
  const profile = useProfile();
  return (
    <section>
      <h1 className="text-2xl font-semibold">Account</h1>
      <div role="tablist" className="mt-4 flex gap-2 border-b border-gray-200">
        {(['profile', 'orders', 'privacy'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm capitalize ${tab === t ? 'border-b-2 border-acme-blue text-acme-blue' : 'text-acme-gray'}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="py-4">
        {tab === 'profile' ? (
          profile.isLoading ? (
            <Spinner label="Loading profile" />
          ) : profile.data ? (
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="font-medium">Name</dt>
                <dd>{profile.data.displayName}</dd>
              </div>
              <div>
                <dt className="font-medium">Email</dt>
                <dd>{profile.data.email}</dd>
              </div>
            </dl>
          ) : (
            <p role="alert">Couldn’t load your profile.</p>
          )
        ) : null}
        {tab === 'orders' ? <OrdersTab /> : null}
        {tab === 'privacy' ? <PrivacyTab /> : null}
      </div>
    </section>
  );
}
