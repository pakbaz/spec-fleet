import type { CartLine } from './schemas';

interface Props {
  line: CartLine;
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

export function CartLineItem({ line, onQuantityChange, onRemove }: Props) {
  return (
    <li
      className="flex items-center justify-between border-b border-gray-100 py-3"
      data-testid={`cart-line-${line.productId}`}
    >
      <div>
        <p className="text-sm font-medium">{line.name}</p>
        <p className="text-xs text-novimart-gray">
          {(line.unitPriceMinor / 100).toFixed(2)} {line.currency}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`qty-${line.productId}`}>
          Quantity for {line.name}
        </label>
        <input
          id={`qty-${line.productId}`}
          type="number"
          min={1}
          value={line.quantity}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v >= 1) onQuantityChange(line.productId, v);
          }}
          className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => onRemove(line.productId)}
          className="text-xs text-red-600 hover:underline"
          aria-label={`Remove ${line.name} from cart`}
        >
          Remove
        </button>
      </div>
    </li>
  );
}
