-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('LIGHT', 'DARK');

-- AlterTable
ALTER TABLE "BrandingSettings" ADD COLUMN     "defaultTheme" "Theme" NOT NULL DEFAULT 'DARK';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "theme" "Theme";
