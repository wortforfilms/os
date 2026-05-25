import { AccountingLedger } from "./accounting/AccountingLedger";
import { ProductionDashboard } from "./dashboard/ProductionDashboard";
import { ScheduleBoard } from "./scheduling/ScheduleBoard";
import { VendorRegistry } from "./vendors/VendorRegistry";

export function TlpApp() {
  return (
    <main className="tlp-app">
      <ProductionDashboard />
      <ScheduleBoard />
      <AccountingLedger />
      <VendorRegistry />
    </main>
  );
}

export * from "./accounting/AccountingLedger";
export * from "./dashboard/ProductionDashboard";
export * from "./scheduling/ScheduleBoard";
export * from "./vendors/VendorRegistry";
