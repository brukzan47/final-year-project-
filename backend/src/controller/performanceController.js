import { Performance } from "../models/Performance.js";

export const getPerformanceRecords = async (req, res) => {
  try {
    const data = await Performance.getAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createPerformanceRecord = async (req, res) => {
  try {
    const record = await Performance.create(req.body);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
