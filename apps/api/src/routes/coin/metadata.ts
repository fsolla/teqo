import { Alchemy, Network } from "alchemy-sdk";
import express from "express";
import { prisma } from "../../lib/prisma";

const config = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(config);

export const metadataRouter = express
  .Router()
  .get("/metadata/:address", async (req, res) => {
    const chain = "ethereum";
    const address = req.params.address;

    try {
      const cached = await prisma.coinMetadata.findUnique({
        where: { chain_address: { chain, address } },
      });

      if (cached) {
        res.status(200).json(cached);
        return;
      }

      const metadata = await alchemy.core.getTokenMetadata(address);

      if (!metadata?.name) {
        res.status(404).json({ error: "Metadata not found" });
        return;
      }

      const saved = await prisma.coinMetadata.create({
        data: {
          chain,
          address,
          name: metadata.name ?? "",
          symbol: metadata.symbol ?? "",
          decimals: metadata.decimals ?? 18,
          logo: metadata.logo ?? "",
        },
      });

      res.status(200).json(saved);
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
