import { body, validationResult } from "express-validator";

export const PAYMENT_METHODS = [
  "Bank Transfer",
  "Cash",
  "Cheque",
  "Mobile Money",
  "Letter of Credit",
  "Telegraphic Transfer",
  "EFT",
];

export const PAYMENT_STATUSES = [
  "Pending",
  "Failed",
  "Verified",
  "Paid",
];

export const validatePayment = [
  body("invoice_value_usd").optional({ nullable: true }).isNumeric().withMessage("invoice_value_usd must be a number"),
  body("exchange_rate").optional({ nullable: true }).isNumeric().withMessage("exchange_rate must be a number"),
  body("duty_paid").optional({ nullable: true }).isNumeric().withMessage("duty_paid must be a number"),
  body("vat_paid").optional({ nullable: true }).isNumeric().withMessage("vat_paid must be a number"),
  body("excise_paid").optional({ nullable: true }).isNumeric().withMessage("excise_paid must be a number"),
  body("total_payable").optional({ nullable: true }).isNumeric().withMessage("total_payable must be a number"),
  body("payment_method").optional({ nullable: true }).isIn(PAYMENT_METHODS).withMessage("payment_method is invalid"),
  body("payment_status").optional({ nullable: true }).isIn(PAYMENT_STATUSES).withMessage("payment_status is invalid"),
  body("payment_date").optional({ nullable: true }).isISO8601().withMessage("payment_date must be a valid date"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    }
    next();
  },
];
