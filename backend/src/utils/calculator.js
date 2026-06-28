export const CustomsCalculator = {
  // Convert CIF from USD to ETB
  cifToETB(cif_usd, exchange_rate) {
    return Number(cif_usd) * Number(exchange_rate);
  },

  // Calculate import duty
  calculateDuty(cif_etb, tariff_rate) {
    return (Number(cif_etb) * Number(tariff_rate)) / 100;
  },

  // Calculate VAT (Ethiopian standard 15%)
  calculateVAT(cif_etb, duty_etb) {
    return (Number(cif_etb) + Number(duty_etb)) * 0.15;
  },

  // Calculate total payable
  totalPayable(cif_etb, duty_etb, vat_etb, excise_etb = 0) {
    return Number(cif_etb) + Number(duty_etb) + Number(vat_etb) + Number(excise_etb);
  },

  // Composite calculation (all-in-one)
  computeAll({ cif_usd, exchange_rate, tariff_rate }) {
    const cif_etb = this.cifToETB(cif_usd, exchange_rate);
    const duty = this.calculateDuty(cif_etb, tariff_rate);
    const vat = this.calculateVAT(cif_etb, duty);
    const total = this.totalPayable(cif_etb, duty, vat);
    return { cif_etb, duty, vat, total };
  },
};
