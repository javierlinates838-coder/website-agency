/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DeepQualifyPanel,
  isEditableTarget,
  shouldCloseModalOnEscape,
} from "../components/DeepQualifyPanel";
import type { Lead } from "../lib/types";

afterEach(() => {
  cleanup();
});

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: "live:roof",
    name: "Ridge Line Roofing",
    industry: "contractors",
    industryLabel: "Roofing",
    city: "Bakersfield, CA",
    address: "100 Main",
    phone: "661-555-0100",
    score: 82,
    kind: "no_website",
    issues: ["No website found"],
    source: "live",
    analyzed: true,
    ...over,
  };
}

function renderPanel() {
  const onClose = vi.fn();
  const onSave = vi.fn();
  render(<DeepQualifyPanel lead={lead()} onClose={onClose} onSave={onSave} />);
  return { onClose, onSave };
}

describe("Deep Qualify modal keyboard and click isolation", () => {
  it("does not close when Backspace is pressed in a focused text input", () => {
    const { onClose } = renderPanel();
    const input = screen.getByLabelText("Business name");
    input.focus();
    fireEvent.keyDown(input, { key: "Backspace" });
    fireEvent.keyDown(input, { key: "Delete" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: " " });
    fireEvent.keyDown(input, { key: "ArrowLeft" });
    fireEvent.change(input, { target: { value: "Ridge" } });
    expect(onClose).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe("Ridge");
  });

  it("does not close when Backspace is pressed in a textarea", () => {
    const { onClose } = renderPanel();
    const textarea = screen.getByLabelText("Risks / conflicts");
    textarea.focus();
    fireEvent.keyDown(textarea, { key: "Backspace" });
    fireEvent.change(textarea, { target: { value: "Seasonal slowdown" } });
    expect(onClose).not.toHaveBeenCalled();
    expect((textarea as HTMLTextAreaElement).value).toBe("Seasonal slowdown");
  });

  it("does not close when clicking inside the modal panel", () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByRole("dialog"));
    fireEvent.mouseDown(screen.getByLabelText("Business name"));
    fireEvent.click(screen.getByLabelText("Business name"));
    fireEvent.click(screen.getByRole("button", { name: "Save qualification" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes when the Close button is clicked", () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close Escape while focus is inside an editable field", () => {
    const { onClose } = renderPanel();
    const input = screen.getByLabelText("Business name");
    const textarea = screen.getByLabelText("Risks / conflicts");
    const select = screen.getByLabelText("Active status");
    input.focus();
    fireEvent.keyDown(input, { key: "Escape" });
    textarea.focus();
    fireEvent.keyDown(textarea, { key: "Escape" });
    select.focus();
    fireEvent.keyDown(select, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape when focus is not inside an editable field", () => {
    const { onClose } = renderPanel();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes only when the backdrop itself is clicked, not a bubbled inner click", () => {
    const { onClose } = renderPanel();
    const backdrop = screen.getByTestId("deep-qualify-backdrop");
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("editable target helpers", () => {
  it("treats inputs, textareas, selects, and contenteditable as editing", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const button = document.createElement("button");
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);
    expect(isEditableTarget(select)).toBe(true);
    expect(isEditableTarget(editable)).toBe(true);
    expect(isEditableTarget(button)).toBe(false);
    expect(shouldCloseModalOnEscape({ key: "Escape", target: input })).toBe(false);
    expect(shouldCloseModalOnEscape({ key: "Escape", target: button })).toBe(true);
    expect(shouldCloseModalOnEscape({ key: "Backspace", target: button })).toBe(false);
  });
});
