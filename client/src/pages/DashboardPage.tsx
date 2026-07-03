import { useBusinesses } from '../businesses/BusinessContext';

const KPI_PLACEHOLDERS = [
  { label: 'Revenue', value: '--' },
  { label: 'Orders', value: '--' },
  { label: 'AOV', value: '--' },
  { label: 'Gross margin', value: '--' },
];

export function DashboardPage() {
  const { activeBusiness } = useBusinesses();

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Overview</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">
          {activeBusiness ? activeBusiness.name : 'Dashboard'}
        </h2>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {KPI_PLACEHOLDERS.map((metric) => (
            <div key={metric.label} className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <dt className="text-sm font-medium text-slate-500">{metric.label}</dt>
              <dd className="mt-2 text-2xl font-bold text-slate-950">{metric.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Sales trend</p>
          <div className="mt-5 h-72 rounded-md border border-dashed border-slate-300 bg-slate-50" />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Channel mix</p>
          <div className="mt-5 h-72 rounded-md border border-dashed border-slate-300 bg-slate-50" />
        </div>
      </section>
    </div>
  );
}
