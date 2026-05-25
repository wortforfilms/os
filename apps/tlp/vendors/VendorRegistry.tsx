import type { VendorRecord } from "../types";

const defaultVendors: VendorRecord[] = [
  { id: "ven-camera", name: "Camera House", service: "camera", compliance: "ready" },
  { id: "ven-grip", name: "Grip Unit", service: "grip", compliance: "pending" },
  { id: "ven-catering", name: "Set Meals", service: "catering", compliance: "ready" },
];

export function VendorRegistry({ vendors = defaultVendors }: { vendors?: VendorRecord[] }) {
  return (
    <section className="vendor-registry">
      <h2>VendorRegistry</h2>
      <ul>
        {vendors.map((vendor) => (
          <li data-compliance={vendor.compliance} key={vendor.id}>
            <strong>{vendor.name}</strong>
            <span>{vendor.service}</span>
            <em>{vendor.compliance}</em>
          </li>
        ))}
      </ul>
    </section>
  );
}
