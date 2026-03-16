-- CreateTable
CREATE TABLE "schemas" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "authorityAddress" TEXT NOT NULL,
    "resolverAddress" TEXT,
    "revocable" BOOLEAN NOT NULL DEFAULT true,
    "hcsTopicId" TEXT,
    "transactionHash" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "consensusTimestamp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attestations" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "schemaUid" TEXT NOT NULL,
    "attesterAddress" TEXT NOT NULL,
    "subjectAddress" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "consensusTimestamp" TEXT,
    "expirationTime" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revocationTime" TIMESTAMP(3),
    "revocationTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorities" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "metadata" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "transactionHash" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "consensusTimestamp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexer_state" (
    "id" TEXT NOT NULL,
    "lastProcessedTimestamp" TEXT NOT NULL,
    "lastProcessedBlock" INTEGER NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'syncing',
    "errorMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexer_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schemas_uid_key" ON "schemas"("uid");

-- CreateIndex
CREATE INDEX "schemas_authorityAddress_idx" ON "schemas"("authorityAddress");

-- CreateIndex
CREATE INDEX "schemas_blockNumber_idx" ON "schemas"("blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "attestations_uid_key" ON "attestations"("uid");

-- CreateIndex
CREATE INDEX "attestations_schemaUid_idx" ON "attestations"("schemaUid");

-- CreateIndex
CREATE INDEX "attestations_attesterAddress_idx" ON "attestations"("attesterAddress");

-- CreateIndex
CREATE INDEX "attestations_subjectAddress_idx" ON "attestations"("subjectAddress");

-- CreateIndex
CREATE INDEX "attestations_revoked_idx" ON "attestations"("revoked");

-- CreateIndex
CREATE INDEX "attestations_blockNumber_idx" ON "attestations"("blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "authorities_address_key" ON "authorities"("address");

-- CreateIndex
CREATE INDEX "authorities_isVerified_idx" ON "authorities"("isVerified");
