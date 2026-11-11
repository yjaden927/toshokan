import { describe, expect, it } from "vitest";
import { bindingFor, emptyForm, toBookInput } from "./form";

describe("toBookInput", () => {
  it("converts the form's strings for the API", () => {
    const input = toBookInput(
      { ...emptyForm, title: " Dune ", author: "Frank Herbert", year: "1965", tags: "sci-fi, , classics ", status: "finished", rating: 5 },
      "#24485e",
    );

    expect(input).toMatchObject({ title: "Dune", year: 1965, genre: "Other", tags: ["sci-fi", "classics"], rating: 5, color: "#24485e" });
  });

  it("drops a rating and dates that the status doesn't allow", () => {
    const input = toBookInput({ ...emptyForm, status: "want_to_read", rating: 4, startedOn: "2026-01-01", finishedOn: "2026-02-01" }, "#24485e");

    expect(input).toMatchObject({ rating: null, startedOn: null, finishedOn: null });
  });

  it("sends no year rather than a broken one", () => {
    expect(toBookInput({ ...emptyForm, year: "nineteen" }, "#24485e").year).toBeNull();
  });
});

describe("bindingFor", () => {
  it("gives a title the same lowercase hex color every time", () => {
    expect(bindingFor("Dune")).toBe(bindingFor("dune"));
    expect(bindingFor("Dune")).toMatch(/^#[0-9a-f]{6}$/);
  });
});
