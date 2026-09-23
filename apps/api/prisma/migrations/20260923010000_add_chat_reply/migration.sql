-- AlterTable: add nullable self-FK for message replies (additive, no backfill)
ALTER TABLE "Message" ADD COLUMN "replyToId" TEXT;

-- AddForeignKey: self-relation, parent hard-delete clears the child's link
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
