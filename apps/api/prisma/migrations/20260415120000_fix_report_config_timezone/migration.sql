-- Fix existing ReportConfig records stuck on UTC default
UPDATE "ReportConfig" SET "timezone" = 'Asia/Ho_Chi_Minh' WHERE "timezone" = 'UTC';
