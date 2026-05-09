import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCrmUpsHistoryFromApi,
  fetchCrmUpsQueueFromApi,
  startCrmUpsQueueCustomerInApi,
  updateCrmUpsQueueCustomerInApi,
} from "./crmApi";

const queueRow = {
  id: "queue-1",
  store: "FD7",
  rep: "Alice Rep",
  rep_user_id: "7",
  status: "working",
  queue_position: 1,
  checked_in_at: "2026-05-09T12:00:00Z",
  current_customer: "Jane Doe",
  current_customer_type: "Regular Up",
  current_customer_details: "Blue sectional",
  started_at: "2026-05-09T12:05:00Z",
  active_customer_count: 1,
  active_customers: [
    {
      id: "active-1",
      queue_entry_id: "queue-1",
      customer: "Jane Doe",
      phone: "252-555-0101",
      email: "jane@example.com",
      customer_type: "Regular Up",
      customer_details: "Blue sectional",
      city: "Morehead City",
      wants_needs: "Sectional and recliner",
      did_purchase: null,
      purchase_amount: null,
      objection_note: "",
      started_at: "2026-05-09T12:05:00Z",
      history_id: "history-1",
    },
  ],
};

const jsonResponse = (body: unknown) => ({
  ok: true,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
}) as Response;

describe("CRM UPS API Option B", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps active UPS customer phone/email from queue rows", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ rows: [queueRow] }));

    const rows = await fetchCrmUpsQueueFromApi("FD7");

    expect(rows[0].activeCustomers[0]).toMatchObject({
      phone: "252-555-0101",
      email: "jane@example.com",
      wantsNeeds: "Sectional and recliner",
    });
  });

  it("maps UPS history phone/email for daily print sheets", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({
      rows: [
        {
          id: "history-1",
          queue_entry_id: "queue-1",
          store: "FD7",
          rep: "Alice Rep",
          customer: "Jane Doe",
          phone: "252-555-0101",
          email: "jane@example.com",
          city: "Morehead City",
          customer_type: "Regular Up",
          customer_details: "Blue sectional",
          wants_needs: "Sectional and recliner",
          did_purchase: false,
          purchase_amount: null,
          objection_note: "Needs to measure",
          started_at: "2026-05-09T12:05:00Z",
          completed_at: "2026-05-09T12:45:00Z",
          counts_as_up: true,
        },
      ],
    }));

    const rows = await fetchCrmUpsHistoryFromApi({ store: "FD7", date: "2026-05-09" });

    expect(rows[0]).toMatchObject({
      phone: "252-555-0101",
      email: "jane@example.com",
      customerDetails: "Blue sectional",
      wantsNeeds: "Sectional and recliner",
    });
  });

  it("sends phone/email when starting an UPS customer", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ row: queueRow }));

    await startCrmUpsQueueCustomerInApi("queue-1", {
      customer: "Jane Doe",
      customerType: "Regular Up",
      phone: "252-555-0101",
      email: "jane@example.com",
      city: "Morehead City",
      wantsNeeds: "Sectional and recliner",
      details: "Blue sectional",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      phone: "252-555-0101",
      email: "jane@example.com",
      city: "Morehead City",
      wants_needs: "Sectional and recliner",
      customer_details: "Blue sectional",
    });
  });

  it("sends phone/email when updating an active UPS customer", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ row: queueRow }));

    await updateCrmUpsQueueCustomerInApi("queue-1", "active-1", {
      phone: "252-555-0101",
      email: "jane@example.com",
      wantsNeeds: "Reclining sofa",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      phone: "252-555-0101",
      email: "jane@example.com",
      wants_needs: "Reclining sofa",
    });
  });
});
