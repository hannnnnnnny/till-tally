const PRODUCT_COLUMNS = ['Product', 'Revenue', 'Margin', 'Units', 'Status'];

export function ProductsPage() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Products</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Performance</h2>
        </div>
        <div className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 sm:w-56" />
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {PRODUCT_COLUMNS.map((column) => (
                <th key={column} scope="col" className="px-4 py-3 font-semibold text-slate-600">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td colSpan={PRODUCT_COLUMNS.length} className="px-4 py-10 text-center text-slate-500">
                No product rows loaded.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
