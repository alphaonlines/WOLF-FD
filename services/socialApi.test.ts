import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteSocialPost } from "./socialApi";

const jsonResponse = (body: unknown) => ({
  ok: true,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
}) as Response;

describe("social API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deletes a social post with the API DELETE endpoint", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, id: "42" }));

    await deleteSocialPost("42");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/fd/api/api/social/posts/42");
    expect(init?.method).toBe("DELETE");
    expect(init?.credentials).toBe("include");
  });
});
