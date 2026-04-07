export function getItemsGoodsTotal(items = []) {
  return items.reduce((sum, item) => sum + item.qty * item.price, 0);
}

export function getOrderTotals(order) {
  const goodsTotal = order.goodsTotal ?? getItemsGoodsTotal(order.items);
  const deliveryShare = order.deliveryShare ?? 0;
  const grandTotal = order.grandTotal ?? goodsTotal + deliveryShare;

  return { goodsTotal, deliveryShare, grandTotal };
}

export function getOrdersGoodsTotal(orders = []) {
  return orders.reduce((sum, order) => sum + getOrderTotals(order).goodsTotal, 0);
}

export function getOrdersGrandTotal(orders = []) {
  return orders.reduce((sum, order) => sum + getOrderTotals(order).grandTotal, 0);
}
