-- CreateTable
CREATE TABLE "OpenIdLoginFlow" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "codeVerifier" TEXT NOT NULL,

    CONSTRAINT "OpenIdLoginFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenIdAccount" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "userId" UUID,
    "serverId" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,

    CONSTRAINT "OpenIdAccount_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OpenIdAccount" ADD CONSTRAINT "OpenIdAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
