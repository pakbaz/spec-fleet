import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
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
          // Redirect to PCI-compliant payment provider — Acme never sees PAN/CVV.
          window.location.assign(session.providerUrl);
        },
      },
    );
  }

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
        {create.isError ? (
          <p role="alert" className="text-sm text-red-600">
            Couldn’t start checkout — please try again.
          </p>
        ) : null}
      </form>
    </section>
  );
}
