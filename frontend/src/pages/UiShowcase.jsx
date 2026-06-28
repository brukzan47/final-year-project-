import React, { useMemo, useState } from "react";
import RiskBadge from "../components/RiskBadge.jsx";
import ShowcaseHeader from "../components/showcase/ShowcaseHeader.jsx";
import ShowcaseSection from "../components/showcase/ShowcaseSection.jsx";
import PreviewCard from "../components/showcase/PreviewCard.jsx";
import MiniKpiCard from "../components/showcase/MiniKpiCard.jsx";
import MiniTablePreview from "../components/showcase/MiniTablePreview.jsx";
import MiniChartPreview from "../components/showcase/MiniChartPreview.jsx";
import ComponentGallery from "../components/showcase/ComponentGallery.jsx";
import ResponsivePreview from "../components/showcase/ResponsivePreview.jsx";
import UiChecklist from "../components/showcase/UiChecklist.jsx";
import StatusBadge from "../components/showcase/StatusBadge.jsx";
import "../styles/showcase.css";

const tabs = [
  ["Dashboard", "dashboard"],
  ["Operators", "operators"],
  ["Declarations", "declarations"],
  ["Shipments", "shipments"],
  ["Inspections", "inspections"],
  ["Payments", "payments"],
  ["Analytics", "analytics"],
  ["Reports", "reports"],
  ["Users", "users"],
  ["Settings", "settings"],
];

const tableRows = [
  { ID: "DECL-2026-1841", Importer: "Addis Industrial Imports", Status: "Cleared" },
  { ID: "DECL-2026-1842", Importer: "Sheger Trading PLC", Status: "Pending", tone: "warning" },
  { ID: "DECL-2026-1843", Importer: "Awash Machinery", Status: "Under Inspection", tone: "info" },
];

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function UiShowcase() {
  const [dark, setDark] = useState(false);
  const summary = useMemo(() => [
    ["Total Pages", "18"],
    ["Total Components", "64"],
    ["Responsive Screens", "3"],
    ["Active Modules", "12"],
    ["UI Status", "Ready"],
  ], []);

  return (
    <div className={`showcase-page${dark ? " showcase-dark" : ""}`}>
      <ShowcaseHeader dark={dark} onToggleDark={() => setDark((value) => !value)} />

      <nav className="showcase-tabs" aria-label="Showcase sections">
        {tabs.map(([label, id]) => <button key={id} type="button" onClick={() => scrollTo(id)}>{label}</button>)}
      </nav>

      <section className="showcase-summary">
        {summary.map(([label, value]) => <MiniKpiCard key={label} label={label} value={value} delta="Production preview" icon="analytics" tone={value === "Ready" ? "green" : "blue"} />)}
      </section>

      <ShowcaseSection id="dashboard" title="Dashboard Preview" route="/home" description="Executive overview with KPIs, declaration trends, activity tables, status, alerts, and ranking widgets." components={["KPI Cards", "Declaration Chart", "Recent Table", "System Status", "Alerts"]}>
        <div className="showcase-grid-3">
          <MiniKpiCard label="Total Declarations" value="1,248" delta="+12.4%" icon="declarationDesk" />
          <MiniKpiCard label="Revenue" value="ETB 2.8M" delta="+15.3%" icon="paymentBoard" tone="blue" />
          <MiniKpiCard label="Active Importers" value="426" delta="+6.2%" icon="economicOperators" />
          <PreviewCard title="Declaration Overview"><MiniChartPreview type="area" /></PreviewCard>
          <PreviewCard title="System Status"><div className="showcase-service-list"><span>Application Server <StatusBadge>Online</StatusBadge></span><span>Database <StatusBadge>Online</StatusBadge></span><span>ASYCUDA World <StatusBadge>Online</StatusBadge></span></div></PreviewCard>
          <PreviewCard title="Top Importers"><div className="showcase-progress-list"><span><i style={{ width: "86%" }} />Addis Industrial</span><span><i style={{ width: "72%" }} />Sheger Trading</span><span><i style={{ width: "61%" }} />Ethio Pharma</span></div></PreviewCard>
          <MiniTablePreview columns={["ID", "Importer", "Status"]} rows={tableRows} />
          <PreviewCard title="Declaration by Type"><MiniChartPreview type="donut" /></PreviewCard>
          <PreviewCard title="Important Alerts"><div className="showcase-alert-list"><span>Pending payment approvals</span><span>Inspection queue threshold</span><span>License expiry review</span></div></PreviewCard>
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="operators" title="Economic Operators Preview" route="/importers" description="Operator registration, risk level, table review, and operator detail cards." components={["Operator KPIs", "Risk Badges", "Operator Table", "Detail Card"]}>
        <div className="showcase-grid-3">
          <MiniKpiCard label="Registered Operators" value="426" delta="+18 this month" icon="economicOperators" />
          <MiniKpiCard label="High Risk" value="24" delta="-2.1%" icon="dataHealth" tone="red" />
          <PreviewCard title="Operator Detail"><strong>Addis Industrial Imports</strong><p>TIN 0054218793</p><RiskBadge channel="Yellow" score={62} /></PreviewCard>
          <MiniTablePreview columns={["ID", "Importer", "Risk"]} rows={[{ ID: "OP-1024", Importer: "Sheger Trading", Risk: "Green" }, { ID: "OP-1025", Importer: "Red Sea Logistics", Risk: "Yellow", tone: "warning" }]} />
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="declarations" title="Declarations Preview" route="/declarations-admin" description="Declaration filters, list table, status badges, detail panel, and timeline preview." components={["Filter Bar", "Status Badges", "Detail Card", "Timeline"]}>
        <div className="showcase-grid-2">
          <PreviewCard title="Filter Bar"><div className="showcase-filter-row"><input placeholder="Declaration number" /><select><option>Status</option></select><button>Apply</button></div></PreviewCard>
          <PreviewCard title="Timeline"><div className="showcase-timeline labelled"><span>Submitted</span><span>Risk Check</span><span>Cleared</span></div></PreviewCard>
          <MiniTablePreview columns={["ID", "Importer", "Status"]} rows={tableRows} />
          <PreviewCard title="Declaration Detail"><p>HS Code 8703.23 | CIF ETB 1.2M</p><StatusBadge>Cleared</StatusBadge></PreviewCard>
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="shipments" title="Shipment Desk Preview" route="/shipments" description="Shipment cards, port of entry, clearance progress, and transport mode badges." components={["Shipment Cards", "Port Entry", "Clearance Status", "Mode Badges"]}>
        <div className="showcase-grid-3">
          {["Sea Freight", "Air Cargo", "Truck"].map((mode) => <PreviewCard key={mode} title={mode}><p>Port: Modjo Dry Port</p><StatusBadge tone="info">In Transit</StatusBadge></PreviewCard>)}
          <MiniTablePreview columns={["ID", "Importer", "Status"]} rows={[{ ID: "SHP-8821", Importer: "Awash Machinery", Status: "Arrived" }, { ID: "SHP-8822", Importer: "Ethio Pharma", Status: "Pending", tone: "warning" }]} />
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="inspections" title="Inspection Desk Preview" route="/inspections" description="Inspection schedule, summary cards, findings, and inspector assignment previews." components={["Summary Cards", "Schedule Table", "Findings", "Assignments"]}>
        <div className="showcase-grid-3">
          <MiniKpiCard label="Scheduled" value="18" delta="Today" icon="inspectionDesk" />
          <MiniKpiCard label="Findings" value="7" delta="Open" icon="reports" tone="amber" />
          <PreviewCard title="Inspector Assignment"><p>Inspector: Hana Bekele</p><StatusBadge tone="info">Assigned</StatusBadge></PreviewCard>
          <MiniTablePreview columns={["ID", "Importer", "Status"]} rows={[{ ID: "INS-441", Importer: "Red Sea Logistics", Status: "Scheduled", tone: "info" }, { ID: "INS-442", Importer: "Sheger Trading", Status: "Completed" }]} />
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="payments" title="Payment Board Preview" route="/payments" description="Revenue KPIs, transactions, reconciliation status, revenue chart, and outstanding balances." components={["Revenue KPIs", "Transactions", "Reconciliation", "Revenue Chart"]}>
        <div className="showcase-grid-3">
          <MiniKpiCard label="Collected" value="ETB 2.8M" delta="+15.3%" icon="paymentBoard" tone="blue" />
          <MiniKpiCard label="Outstanding" value="ETB 340K" delta="Review" icon="financeWorkspace" tone="amber" />
          <PreviewCard title="Revenue Chart"><MiniChartPreview type="bars" /></PreviewCard>
          <MiniTablePreview columns={["ID", "Importer", "Status"]} rows={[{ ID: "PAY-882", Importer: "Awash Machinery", Status: "Reconciled" }, { ID: "PAY-883", Importer: "Sheger Trading", Status: "Pending", tone: "warning" }]} />
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="analytics" title="Smart Analytics Preview" route="/smart-analytics" description="Analytics KPIs, revenue trends, risk distribution, AI insights, and branch performance." components={["Insight Cards", "Revenue Trend", "Risk Distribution", "Branch Performance"]}>
        <div className="showcase-grid-3">
          <MiniKpiCard label="Risk Score Avg" value="42" delta="-8%" icon="smartAnalytics" tone="blue" />
          <PreviewCard title="Revenue Trend"><MiniChartPreview type="line" /></PreviewCard>
          <PreviewCard title="Risk Distribution"><MiniChartPreview type="donut" /></PreviewCard>
          <PreviewCard title="AI Insight"><p>Clearance delay risk is rising at Modjo Dry Port.</p><StatusBadge tone="warning">Actionable</StatusBadge></PreviewCard>
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="reports" title="Reports Preview" route="/reports" description="Report category cards, date filters, export actions, and report table previews." components={["Report Cards", "Date Filters", "Export Buttons", "Report Table"]}>
        <div className="showcase-grid-3">
          {["Revenue", "Risk", "Clearance"].map((label) => <PreviewCard key={label} title={`${label} Report`}><button>Export CSV</button></PreviewCard>)}
          <PreviewCard title="Date Filter"><div className="showcase-filter-row"><input type="date" /><input type="date" /><button>Run</button></div></PreviewCard>
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="notifications" title="Notifications Preview" route="/notifications-admin" description="Notification lists, unread badges, alert categories, and system messages." components={["Unread Badge", "Categories", "System Messages"]}>
        <div className="showcase-grid-3">
          {["Approval Requests", "Pending Payments", "Shipment Arrivals", "Inspection Alerts", "License Expiry", "System Updates"].map((label, index) => <PreviewCard key={label} title={label}><StatusBadge tone={index % 2 ? "warning" : "success"}>{index + 2} unread</StatusBadge></PreviewCard>)}
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="users" title="Users and Roles Preview" route="/users" description="User table, role badges, permission cards, and admin controls." components={["User Table", "Role Badges", "Permissions", "Admin Controls"]}>
        <div className="showcase-grid-2">
          <MiniTablePreview columns={["ID", "Importer", "Role"]} rows={[{ ID: "USR-01", Importer: "System Administrator", Role: "Admin" }, { ID: "USR-02", Importer: "Mekdes Alemu", Role: "Officer", tone: "info" }]} />
          <PreviewCard title="Permission Cards"><div className="showcase-permission-grid"><StatusBadge>Read</StatusBadge><StatusBadge>Approve</StatusBadge><StatusBadge tone="warning">Audit</StatusBadge></div></PreviewCard>
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="file-upload" title="File Upload Preview" route="/file-upload" description="Drag-and-drop upload, uploaded document list, status badges, and document preview panel." components={["Upload Box", "Document List", "File Badges", "Preview Panel"]}>
        <div className="showcase-grid-2">
          <div className="showcase-upload-box large">Drag customs invoices, packing lists, and certificates here</div>
          <MiniTablePreview columns={["ID", "Importer", "Status"]} rows={[{ ID: "DOC-91", Importer: "Commercial Invoice.pdf", Status: "Verified" }, { ID: "DOC-92", Importer: "Certificate.pdf", Status: "Pending", tone: "warning" }]} />
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="settings" title="System Settings Preview" route="/profile" description="Security, branch, notification, and theme settings preview." components={["Security Settings", "Branch Settings", "Notifications", "Theme"]}>
        <div className="showcase-grid-4">
          {["Security", "Branch", "Notifications", "Theme"].map((label) => <PreviewCard key={label} title={label}><p>{label} configuration card.</p><StatusBadge>Enabled</StatusBadge></PreviewCard>)}
        </div>
      </ShowcaseSection>

      <ComponentGallery />
      <ResponsivePreview />
      <UiChecklist />
    </div>
  );
}
