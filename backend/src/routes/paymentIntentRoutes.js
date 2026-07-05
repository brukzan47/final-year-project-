import express from "express";
import {
  createIntent,
  getIntent,
  getPaymentProviders,
  mockSucceed,
  receiptByDeclaration,
  initiateFromPayment,
  webhookAwash,
  webhookCBE,
  webhookChapa,
  webhookTelebirr,
} from "../controller/paymentIntentController.js";

const router = express.Router();

router.get("/providers", getPaymentProviders);
router.post("/intent", createIntent);
router.post("/:id/initiate", initiateFromPayment);
router.get("/intent/:id", getIntent);
router.post("/mock/:id/succeed", mockSucceed);
router.post("/webhook/cbe", webhookCBE);
router.post("/webhook/awash", webhookAwash);
router.post("/webhook/telebirr", webhookTelebirr);
router.post("/webhook/chapa", webhookChapa);
router.get("/receipt/by-declaration/:id", receiptByDeclaration);

export default router;
