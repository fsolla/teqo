import express from "express";

export const fernRouter = express.Router().post("/fern", async (req, res) => {
  console.log("Received Fern event:", req.body);

  res.status(200).send("OK");
});
