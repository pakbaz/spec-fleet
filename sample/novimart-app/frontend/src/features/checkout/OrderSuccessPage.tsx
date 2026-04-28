import { useSearchParams } from 'react-router-dom';
import { useCheckoutCompletion } from './api';
import { Spinner } from '@/ui/Spinner';

export function OrderSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id') ?? undefined;
  const completion = useCheckoutCompletion(sessionId);

  if (!sessionId) {
    return <p role="alert">Missing session id.</p>;
  }
  if (completion.isLoading) return <Spinner label="Confirming your order" />;
  if (completion.isError || !completion.data) {
    return (
      <p role="alert" className="text-sm text-red-600">
        Couldn’t confirm your order yet.
      </p>
    );
  }
  return (
    <section>
      <h1 className="text-2xl font-semibold">Thanks for your order</h1>
      <p className="mt-2 text-novimart-gray">Order ID: {completion.data.orderId}</p>
      <p className="text-novimart-gray">Status: {completion.data.status}</p>
    </section>
  );
}
