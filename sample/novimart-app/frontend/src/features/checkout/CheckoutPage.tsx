import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import type { ApiError } from '@/lib/api/types';
import { useCreateCheckoutSession } from './api';

export function CheckoutPage() {
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('DE');
  const create = useCreateCheckoutSession();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    create.mutate(
      { shippingAddress: { line1, city, postalCode, country } },
      {
        onSuccess: (session) => {
          // Redirect to PCI-compliant payment provider — NoviMart never sees PAN/CVV.
          window.location.assign(session.providerUrl);
        },
      },
    );
  }

  // spec: checkout-hardening — 401 from the BFF must invite re-authentication
  // rather than a generic failure (a session expiry mid-checkout is the most
  // common cause). The api client maps status 401 → code `auth_required`.
  const apiError = create.error as ApiError | undefined;
  const isAuthRequired = apiError?.code === 'auth_required';

  return (
    <section>
      <h1 className="mb-4 text-2xl font-semibold">Checkout</h1>
      <form onSubmit={onSubmit} className="grid max-w-md gap-3">
        <Input label="Address line 1" required value={line1} onChange={(e) => setLine1(e.target.value)} />
        <Input label="City" required value={city} onChange={(e) => setCity(e.target.value)} />
        <Input
          label="Postal code"
          required
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
        />
        <Input label="Country (ISO-2)" required value={country} onChange={(e) => setCountry(e.target.value)} />
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Redirecting…' : 'Continue to payment'}
        </Button>
        {isAuthRequired ? (
          <p role="alert" className="text-sm text-amber-700">
            Your session expired. <a href="/account/sign-in?return=/checkout" className="underline">Sign in to continue</a>.
          </p>
        ) : create.isError ? (
          <p role="alert" className="text-sm text-red-600">
            Couldn’t start checkout — please try again.
          </p>
        ) : null}
      </form>
    </section>
  );
}
