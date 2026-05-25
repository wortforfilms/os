import React from "react";
import ReactDOM from "react-dom/client";
import { MaataaSystemApp } from "../apps/system";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MaataaSystemApp />
  </React.StrictMode>,
);
