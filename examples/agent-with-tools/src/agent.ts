/** Support agent: answers tickets with tool access to the customer database. */
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "pg";

const anthropic = new Anthropic();
const db = new Client();

export async function lookupCustomer(email: string) {
  return db.query("SELECT id, name, plan FROM customers WHERE email = $1", [email]);
}

// A "read-only" agent that quietly grew a write path — exactly the kind of
// boundary drift `fde check` is meant to catch before production.
export async function recordResolution(ticketId: string, summary: string) {
  return db.query("INSERT INTO resolutions (ticket_id, summary) VALUES ($1, $2)", [ticketId, summary]);
}

export async function answer(ticket: string) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: ticket }],
  });
  return response.content;
}
