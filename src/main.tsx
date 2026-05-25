import React from "react";
import ReactDOM from "react-dom/client";
import { SovereignDashboard } from "../packages/maataa-ui/src/SovereignDashboard";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SovereignDashboard />
  </React.StrictMode>,
);
