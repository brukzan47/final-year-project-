import {
  notifyImporterByDeclaration as notifyDeclarationImporter,
  notifyImporterByShipment as notifyShipmentImporter,
  notifyRoleGroup,
} from "../services/notificationService.js";

export async function notifyImporterByDeclaration({ declaration_id, title, message }) {
  await notifyDeclarationImporter({
    declarationId: declaration_id,
    title,
    message,
  });
}

export async function notifyImporterByShipment({ shipment_id, title, message }) {
  await notifyShipmentImporter({
    shipmentId: shipment_id,
    title,
    message,
  });
}

export async function notifyOfficers({ title, message }) {
  await notifyRoleGroup({
    roles: ["Admin", "Customs Officer"],
    title,
    message,
    category: "SYSTEM",
    type: "INFO",
  });
}
