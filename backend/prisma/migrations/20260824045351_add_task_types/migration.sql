-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "task_type_id" TEXT;

-- CreateTable
CREATE TABLE "task_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_types_user_id_idx" ON "task_types"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_types_name_user_id_key" ON "task_types"("name", "user_id");

-- CreateIndex
CREATE INDEX "Assignment_task_type_id_idx" ON "Assignment"("task_type_id");

-- AddForeignKey
ALTER TABLE "task_types" ADD CONSTRAINT "task_types_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_task_type_id_fkey" FOREIGN KEY ("task_type_id") REFERENCES "task_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
