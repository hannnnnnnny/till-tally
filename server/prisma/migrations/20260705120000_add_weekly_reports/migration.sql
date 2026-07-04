-- CreateTable
CREATE TABLE "weekly_reports" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "week_end" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "sales_change_percent" DECIMAL(6,2),
    "top_category" VARCHAR(80),
    "low_stock_count" INTEGER NOT NULL DEFAULT 0,
    "slow_mover_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weekly_reports_business_id_week_start_key" ON "weekly_reports"("business_id", "week_start");

-- AddForeignKey
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
