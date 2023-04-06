-- CreateTable
CREATE TABLE "Team" (
    "snowflake" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Player" (
    "snowflake" TEXT NOT NULL,
    "teamSnowflake" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "blacklisted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Player_teamSnowflake_fkey" FOREIGN KEY ("teamSnowflake") REFERENCES "Team" ("snowflake") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_snowflake_key" ON "Team"("snowflake");

-- CreateIndex
CREATE UNIQUE INDEX "Player_snowflake_key" ON "Player"("snowflake");
