// Synthetic UUIDs only; production IDs are resolved from Supabase at runtime.
export const businessId = '00000000-0000-4000-8000-000000000001';
export const ownerId = '00000000-0000-4000-8000-000000000002';
export const branches = ['Palma', 'Manar', 'Haykaliye', 'Main Branch', 'POS_ACCEPTENCE_ONLY'].map((name, index) => ({
  id: `10000000-0000-4000-8000-00000000000${index + 1}`, name, business_id: businessId,
}));
export const allowedIds = branches.slice(0, 3).map(branch => branch.id);
export function makeSnapshot(ids: string[] = allowedIds) {
  const selected = branches.filter(branch => ids.includes(branch.id));
  const date = new Date().toISOString();
  const price = (id: string) => [10, 20, 30, 9000, 8000][branches.findIndex(branch => branch.id === id)];
  const scope = (branch: typeof branches[number]) => ({ business_id: businessId, branch_id: branch.id });
  const label = (branch: typeof branches[number]) => allowedIds.includes(branch.id) ? branch.name : 'HIDDEN_' + branch.id;
  const record = (branch: typeof branches[number]) => ({
    id: 'sale-' + label(branch), date, currency: 'USD', exchangeRate: 89500, cashierName: label(branch) + '-cashier',
    subtotal: price(branch.id) * 2, total: price(branch.id) * 2,
    items: [{ productId: 'product-' + branch.id, productName: label(branch) + '-product', quantity: 2, salePrice: price(branch.id), purchasePrice: price(branch.id) / 10 }],
  });
  const history = (table: string) => selected.map(branch => ({ ...scope(branch), id: table + '-' + label(branch), total: price(branch.id) }));
  return {
    products: selected.map(branch => ({ ...scope(branch), id: 'product-' + branch.id, name: label(branch) + '-product', is_active: true, stock: 3, minimum_stock: 5, price: price(branch.id), cost: price(branch.id) / 10, barcode: label(branch) })),
    sales: selected.map(branch => ({ ...scope(branch), record: record(branch) })),
    refunds: selected.map(branch => {
      const original = record(branch);
      return { ...scope(branch), record: { id: 'refund-' + label(branch), saleId: original.id, date, currency: 'USD', exchangeRate: 89500, cashierName: original.cashierName, totalRefunded: price(branch.id), items: original.items.map(item => ({ ...item, quantity: 1 })) } };
    }),
    historical: { sales: history('sales'), sale_items: history('sale_items'), refunds: history('refunds'), refund_items: history('refund_items') },
  };
}
