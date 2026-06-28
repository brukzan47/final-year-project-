import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";
import { GoodsItemController } from "../controller/goodsItemController.js";

const router = express.Router();

router.post(
  "/",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer", "Inspector", "Importer"),
  GoodsItemController.create
);

router.get(
  "/declaration/:declaration_id",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer", "Inspector", "Importer"),
  GoodsItemController.listByDeclaration
);

router.get(
  "/shipment/:shipment_id",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer", "Inspector", "Importer"),
  GoodsItemController.listByShipment
);

router.patch(
  "/:goods_item_id",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer", "Inspector"),
  GoodsItemController.update
);

router.delete(
  "/:goods_item_id",
  verifyToken,
  authorizeRoles("Admin", "Customs Officer", "Document Officer", "Inspector"),
  GoodsItemController.remove
);

export default router;

