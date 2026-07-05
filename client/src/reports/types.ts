export type WeeklyReport = {
  id: string;
  businessId: string;
  weekStart: string;
  weekEnd: string;
  summary: string;
  salesChangePercent: number | null;
  topCategory: string | null;
  lowStockCount: number;
  slowMoverCount: number;
  createdAt: string;
};

export type WeeklyReportQuery = {
  weekStart?: string;
};

export type GenerateWeeklyReportInput = {
  weekStart?: string;
};
