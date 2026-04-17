"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";

function Message({ state }) {
  if (!state?.message) return null;

  return (
    <InlineMessage type={state.ok ? "success" : "error"} className="mt-3">
      {state.message}
    </InlineMessage>
  );
}

function SubmitButton({ children }) {
  return (
    <Button type="submit" size="md">
      {children}
    </Button>
  );
}

const inputClassName =
  "h-10 rounded-md border border-[color:var(--cb-line-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(var(--cb-accent-rgb),0.34)]";

export function CreateSupplierForm({ action }) {
  const [state, formAction] = useActionState(action, null);

  return (
    <div>
      <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
        <input name="name" placeholder="Название поставщика" className={inputClassName} />
        <input name="minOrderSum" placeholder="Минимальная сумма заказа" className={inputClassName} />
        <input name="deliveryFee" placeholder="Стоимость доставки, ₽" className={inputClassName} />
        <input name="phone" placeholder="Телефон" className={inputClassName} />
        <input name="email" placeholder="Email" className={inputClassName} />
        <div className="md:col-span-2">
          <SubmitButton>Добавить поставщика</SubmitButton>
        </div>
      </form>

      <Message state={state} />
    </div>
  );
}

export function AddDeliveryZoneForm({ action, supplierId, settlements }) {
  const [state, formAction] = useActionState(action, null);

  return (
    <div>
      <form action={formAction} className="mt-3 flex flex-wrap gap-3">
        <input type="hidden" name="supplierId" value={supplierId} />

        <select
          name="settlementId"
          className={`w-full md:w-[26rem] ${inputClassName}`}
          defaultValue=""
        >
          <option value="" disabled>
            Выберите населённый пункт
          </option>
          {settlements.map((settlement) => (
            <option key={settlement.id} value={settlement.id}>
              {settlement.label}
            </option>
          ))}
        </select>

        <SubmitButton>Добавить зону</SubmitButton>
      </form>

      <Message state={state} />
    </div>
  );
}

export function CreateProductForm({ action, supplierId, categories, units }) {
  const [state, formAction] = useActionState(action, null);

  return (
    <div>
      <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
        <input type="hidden" name="supplierId" value={supplierId} />

        <input name="name" placeholder="Наименование товара" className={inputClassName} />

        <select name="categoryId" defaultValue="" className={inputClassName}>
          <option value="" disabled>
            Категория
          </option>
          {(categories ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <select name="unitId" defaultValue="" className={inputClassName}>
          <option value="" disabled>
            Единица измерения
          </option>
          {(units ?? []).map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>

        <input name="price" placeholder="Цена" className={inputClassName} />
        <input name="sku" placeholder="SKU" className={inputClassName} />
        <input name="imageUrl" placeholder="Ссылка на изображение" className={inputClassName} />

        <div className="md:col-span-2">
          <SubmitButton>Добавить товар</SubmitButton>
        </div>
      </form>

      <Message state={state} />
    </div>
  );
}
