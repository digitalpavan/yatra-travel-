import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";

export interface VehicleRow {
  id: string;
  registration_number: string;
  vehicle_class: string;
  model: string;
  seats: number;
  is_ac: boolean;
  status: "active" | "maintenance" | "retired";
  permit_valid_until: string | null;
  insurance_valid_until: string | null;
  notes: string | null;
}

export interface DriverRow {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string;
  license_number: string;
  license_valid_until: string | null;
  languages: string[];
  status: "active" | "inactive";
  profiles: { email: string | null } | null;
}

export const VEHICLE_LABELS = {
  registration_number: "Registration number",
  vehicle_class: "Vehicle class",
  model: "Model",
  seats: "Seats",
  status: "Status",
  permit_valid_until: "Permit valid until",
  insurance_valid_until: "Insurance valid until",
  notes: "Notes",
};

export const DRIVER_LABELS = {
  full_name: "Full name",
  phone: "Phone",
  license_number: "Licence number",
  license_valid_until: "Licence valid until",
  languages: "Languages",
  status: "Status",
  user_email: "Linked account email",
};

/** Field ids must be unique per page, so each form gets a prefix. */
export function VehicleFields({
  prefix,
  classes,
  vehicle,
}: {
  prefix: string;
  classes: { vehicle_class: string; label: string }[];
  vehicle?: VehicleRow;
}) {
  const id = (n: string) => `${prefix}-${n}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Registration number" name={id("registration_number")} required hint="Stored in upper case, e.g. AP 03 TA 1234">
        <Input
          name="registration_number"
          id={id("registration_number")}
          required
          maxLength={15}
          defaultValue={vehicle?.registration_number}
          className="uppercase"
        />
      </Field>
      <Field label="Vehicle class" name={id("vehicle_class")} required>
        <Select name="vehicle_class" id={id("vehicle_class")} required defaultValue={vehicle?.vehicle_class ?? ""}>
          <option value="" disabled>
            Choose…
          </option>
          {classes.map((c) => (
            <option key={c.vehicle_class} value={c.vehicle_class}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Model" name={id("model")} required>
        <Input name="model" id={id("model")} required maxLength={120} defaultValue={vehicle?.model} placeholder="Toyota Innova Crysta" />
      </Field>
      <Field label="Seats (passengers)" name={id("seats")} required>
        <Input name="seats" id={id("seats")} type="number" min={1} max={60} required defaultValue={vehicle?.seats} />
      </Field>
      <Field label="Status" name={id("status")} required>
        <Select name="status" id={id("status")} defaultValue={vehicle?.status ?? "active"}>
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </Select>
      </Field>
      <div className="flex items-end pb-2">
        <Checkbox name="is_ac" id={id("is_ac")} label="Air-conditioned" defaultChecked={vehicle?.is_ac ?? true} />
      </div>
      <Field label="Permit valid until" name={id("permit_valid_until")}>
        <Input name="permit_valid_until" id={id("permit_valid_until")} type="date" defaultValue={vehicle?.permit_valid_until ?? ""} />
      </Field>
      <Field label="Insurance valid until" name={id("insurance_valid_until")}>
        <Input name="insurance_valid_until" id={id("insurance_valid_until")} type="date" defaultValue={vehicle?.insurance_valid_until ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes" name={id("notes")}>
          <Textarea name="notes" id={id("notes")} maxLength={1000} defaultValue={vehicle?.notes ?? ""} className="min-h-20" />
        </Field>
      </div>
    </div>
  );
}

export function DriverFields({ prefix, driver }: { prefix: string; driver?: DriverRow }) {
  const id = (n: string) => `${prefix}-${n}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" name={id("full_name")} required>
        <Input name="full_name" id={id("full_name")} required maxLength={120} defaultValue={driver?.full_name} />
      </Field>
      <Field label="Phone" name={id("phone")} required>
        <Input name="phone" id={id("phone")} type="tel" required defaultValue={driver?.phone} placeholder="98765 43210" />
      </Field>
      <Field label="Licence number" name={id("license_number")} required>
        <Input name="license_number" id={id("license_number")} required maxLength={30} defaultValue={driver?.license_number} className="uppercase" />
      </Field>
      <Field label="Licence valid until" name={id("license_valid_until")}>
        <Input name="license_valid_until" id={id("license_valid_until")} type="date" defaultValue={driver?.license_valid_until ?? ""} />
      </Field>
      <Field label="Languages" name={id("languages")} hint="Comma separated, e.g. Telugu, Tamil, Hindi">
        <Input name="languages" id={id("languages")} defaultValue={driver ? driver.languages.join(", ") : "Telugu"} />
      </Field>
      <Field label="Status" name={id("status")} required>
        <Select name="status" id={id("status")} defaultValue={driver?.status ?? "active"}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field
          label="Linked account email (optional)"
          name={id("user_email")}
          hint="Links the driver to an existing sign-in so they can see their trips. Leave blank to unlink."
        >
          <Input
            name="user_email"
            id={id("user_email")}
            type="email"
            autoComplete="off"
            defaultValue={driver?.profiles?.email ?? ""}
          />
        </Field>
      </div>
    </div>
  );
}
