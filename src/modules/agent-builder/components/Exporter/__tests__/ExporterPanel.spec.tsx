import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { ExporterPanel } from "../ExporterPanel";

describe("ExporterPanel", () => {
  it("renders tabs and envelope preview", () => {
    const doc: any = { id: "g", name: "t", nodes: [], edges: [] };
    render(<ExporterPanel doc={doc} />);
    expect(screen.getByText(/Exporter/)).toBeTruthy();
    expect(screen.getByText(/Envelope/)).toBeTruthy();
    expect(screen.getByLabelText(/execute envelope/i)).toBeTruthy();
  });
});
