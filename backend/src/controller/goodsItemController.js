import { GoodsItem } from "../models/GoodsItem.js";

export const GoodsItemController = {
  async create(req, res) {
    try {
      const { declaration_id, shipment_id, hs_code, quantity, value_usd } = req.body || {};
      if ((!declaration_id && !shipment_id) || !hs_code) {
        return res.status(400).json({ error: "hs_code and one of declaration_id or shipment_id are required" });
      }
      const item = await GoodsItem.create({
        declaration_id,
        shipment_id,
        hs_code,
        description: req.body.description,
        quantity,
        unit_of_measure: req.body.unit_of_measure,
        value_usd,
        origin_country: req.body.origin_country,
      });
      return res.status(201).json(item);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async listByDeclaration(req, res) {
    try {
      const { declaration_id } = req.params || {};
      if (!declaration_id) return res.status(400).json({ error: "declaration_id param is required" });
      const items = await GoodsItem.listByDeclaration(declaration_id);
      return res.json(items);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async listByShipment(req, res) {
    try {
      const { shipment_id } = req.params || {};
      if (!shipment_id) return res.status(400).json({ error: "shipment_id param is required" });
      const items = await GoodsItem.listByShipment(shipment_id);
      return res.json(items);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async update(req, res) {
    try {
      const { goods_item_id } = req.params || {};
      if (!goods_item_id) return res.status(400).json({ error: "goods_item_id param is required" });
      const updated = await GoodsItem.updateFields(goods_item_id, req.body || {});
      if (!updated) return res.status(404).json({ error: "Goods item not found or no fields to update" });
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async remove(req, res) {
    try {
      const { goods_item_id } = req.params || {};
      if (!goods_item_id) return res.status(400).json({ error: "goods_item_id param is required" });
      await GoodsItem.remove(goods_item_id);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};
