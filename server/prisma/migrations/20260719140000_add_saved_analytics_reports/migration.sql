-- CreateEnum
CREATE TYPE "AnalyticsPlanSource" AS ENUM ('LOCAL', 'PROVIDER');

-- CreateTable
CREATE TABLE "saved_reports" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_report_versions" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "plan" JSONB NOT NULL,
    "plan_source" "AnalyticsPlanSource" NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_reports_business_id_owner_user_id_updated_at_idx" ON "saved_reports"("business_id", "owner_user_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "saved_report_versions_report_id_version_key" ON "saved_report_versions"("report_id", "version");

-- CreateIndex
CREATE INDEX "saved_report_versions_created_by_user_id_idx" ON "saved_report_versions"("created_by_user_id");

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_report_versions" ADD CONSTRAINT "saved_report_versions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "saved_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_report_versions" ADD CONSTRAINT "saved_report_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
