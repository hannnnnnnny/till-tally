const INVENTORY_GROUPS = [
  'Low stock',
  'Stockout risk',
  'Slow movers',
  'Dead stock',
  'Overstocked',
];

export function InventoryPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Inventory</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">Risk overview</h2>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {INVENTORY_GROUPS.map((group) => (
            <div key={group} className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <dt className="text-sm font-medium text-slate-500">{group}</dt>
              <dd className="mt-2 text-2xl font-bold text-slate-950">--</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Products</p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">Inventory actions</h3>
          </div>
          <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1 sm:w-64">
            <button type="button" className="rounded bg-white px-3 py-2 text-sm font-medium shadow-sm">
              Low stock
            </button>
            <button type="button" className="rounded px-3 py-2 text-sm font-medium text-slate-600">
              Slow movers
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          No inventory rows loaded.
        </div>
      </section>
    </div>
  );
}
