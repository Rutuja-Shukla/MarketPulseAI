import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CountryPicker } from "@/features/research/CountryPicker";

const countries = [
  { code: "AU", name: "Australia", region: "Oceania" },
  { code: "NZ", name: "New Zealand", region: "Oceania" },
  { code: "IN", name: "India", region: "Asia" },
  { code: "GB", name: "United Kingdom", region: "Europe" },
];

function Harness({ onChange }: { onChange?: (next: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(["AU"]);
  return (
    <CountryPicker
      countries={countries}
      selected={selected}
      onChange={(next) => {
        setSelected(next);
        onChange?.(next);
      }}
    />
  );
}

describe("country picker", () => {
  it("filters countries by search term", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText(/search countries/i), "india");
    expect(screen.getByRole("button", { name: /India IN/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /United Kingdom GB/ })).not.toBeInTheDocument();
  });

  it("adds and removes a selected country", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /New Zealand NZ/ }));
    expect(onChange).toHaveBeenCalledWith(["AU", "NZ"]);

    const chip = screen.getByRole("button", { name: /^AU/ });
    await user.click(chip);
    expect(onChange).toHaveBeenLastCalledWith(["NZ"]);
  });

  it("shows an empty search state", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText(/search countries/i), "atlantis");
    expect(screen.getByText(/no countries match/i)).toBeInTheDocument();
  });
});
