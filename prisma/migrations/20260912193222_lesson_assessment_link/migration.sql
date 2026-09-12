-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "assessmentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_assessmentId_key" ON "Lesson"("assessmentId");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
