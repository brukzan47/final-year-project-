import { body, validationResult } from "express-validator";

export const INSPECTION_RESULTS = ["Passed", "Failed"];
export const RISK_CHANNELS = ["Green", "Yellow", "Red"];

export const validateInspection = [
  body("inspection_result").optional({ nullable: true }).isIn(INSPECTION_RESULTS).withMessage("inspection_result must be Passed or Failed"),
  body("risk_channel").optional({ nullable: true }).isIn(RISK_CHANNELS).withMessage("risk_channel must be Green, Yellow, or Red"),
  body("inspection_date").optional({ nullable: true }).isISO8601().withMessage("inspection_date must be a valid date"),
  body("release_date").optional({ nullable: true }).isISO8601().withMessage("release_date must be a valid date"),
  body("storage_days").optional({ nullable: true }).isNumeric().withMessage("storage_days must be a number"),
  body("supervisor_approved").optional({ nullable: true }).isBoolean().withMessage("supervisor_approved must be boolean"),
  body("supervisor_reason").optional({ nullable: true }).isString().withMessage("supervisor_reason must be text"),
  body("override_reason").optional({ nullable: true }).isString().withMessage("override_reason must be text"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    }
    next();
  },
];
