/*
  Warnings:

  - Added the required column `scheduledTime` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Task" ADD COLUMN "frequency" TEXT;
ALTER TABLE "Task" ADD COLUMN "lastResult" TEXT;
ALTER TABLE "Task" ADD COLUMN "lastRunAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Task" ADD COLUMN "scheduledTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Task" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';

-- Remove the default after adding the column
ALTER TABLE "Task" ALTER COLUMN "scheduledTime" DROP DEFAULT;
