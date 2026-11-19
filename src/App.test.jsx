// @vitest-environment jsdom
import React from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "./App";
import { api } from "./api";
vi.mock("./api", () => ({ api: vi.fn(), downloadJSON: vi.fn() }));
const config = {
  answer_mode: "auto",
  effective_answer_mode: "extractive",
  embedding_backend: "lexical",
  settings: { top_k: 5, candidate_k: 20, min_similarity: 0.25, rerank: false },
};
beforeEach(() => {
  sessionStorage.clear();
  api.mockReset();
  api.mockImplementation(async (path, options) => {
    if (path === "/config") return config;
    if (path === "/stats")
      return {
        documents: 1,
        ready: 1,
        chunks: 1,
        questions: 0,
        failed_queries: 0,
      };
    if (path.startsWith("/documents"))
      return {
        items: [
          {
            id: "d1",
            name: "policy.txt",
            status: "ready",
            chunk_count: 1,
            size: 30,
          },
        ],
        total: 1,
      };
    if (path === "/chat")
      return {
        id: "m1",
        conversation_id: "c1",
        mode: "extractive",
        status: "answered",
        answerType: "document_based",
        confidence: "high",
        answer: "### Annual leave\n\nEmployees receive **24 days** of annual leave [S1].",
        sources: [
          {
            id: "s1",
            citation: "S1",
            filename: "policy.txt",
            name: "policy.txt",
            pageNumber: 1,
            location: "Text section",
            text: "24 days of annual leave",
            similarity: 0.8,
            relevanceScore: 0.8,
            bm25: 2,
            rrf: 0.03,
          },
        ],
        latency_ms: 10,
      };
    if (path === "/settings") return JSON.parse(options.body);
    return { items: [], total: 0 };
  });
});
afterEach(cleanup);
describe("Workspace interactions", () => {
  it("submits scoped questions and renders evidence", async () => {
    render(<App />);
    await screen.findByText("policy.txt");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "What is the leave allowance?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ask Atlas/ }));
    expect((await screen.findAllByText(/24 days/)).length).toBeGreaterThan(0);
    expect(screen.getByText("Annual leave")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /\[S1\] policy\.txt/ }),
    ).toBeInTheDocument();
    const call = api.mock.calls.find(([path]) => path === "/chat");
    expect(JSON.parse(call[1].body).document_ids).toEqual(["d1"]);
  });
  it("renders actionable backend errors inside the answer area", async () => {
    const original = api.getMockImplementation();
    api.mockImplementation((path, opts) =>
      path === "/chat"
        ? Promise.reject(
            new Error("No processed files are available. Upload a file first."),
          )
        : original(path, opts),
    );
    render(<App />);
    await screen.findByText("policy.txt");
    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "What is leave?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ask Atlas/ }));
    expect(
      await screen.findByText(
        "No processed files are available. Upload a file first.",
      ),
    ).toBeInTheDocument();
  });
  it("saves edited retrieval settings", async () => {
    render(<App />);
    await screen.findByText("policy.txt");
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    fireEvent.change(screen.getByLabelText("Minimum cosine similarity"), {
      target: { value: "0.1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await screen.findByText("Retrieval settings saved.");
    const call = api.mock.calls.find(([path]) => path === "/settings");
    expect(JSON.parse(call[1].body).min_similarity).toEqual(0.1);
  });
});
