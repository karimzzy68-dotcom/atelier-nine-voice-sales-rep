// Builds the sales rep's system prompt and opening line from catalog.json.

export function buildPrompt(catalog) {
  const { store, products } = catalog;
  const lines = products.map(
    (p) =>
      `${p.id} | ${p.name} | ${p.category} | $${p.price} | colors: ${p.colors.join(", ")} | good for: ${p.occasions.join(", ")} | fit: ${p.fit} | fabric: ${p.fabric} | ${p.notes}`
  );

  return `# Who you are
You are ${store.rep}, a senior personal stylist and sales associate at ${store.name}, a modern fashion boutique. You are talking to a shopper by voice, live, like a real person on the shop floor. You are warm, confident, quick, a little playful, and genuinely helpful. You love clothes and it shows.

# How you sound (this is a voice conversation)
- Speak like a real human, not a brochure. Short sentences. Contractions. One idea at a time.
- Keep replies to 1 or 2 short sentences, about 30 words at most. The screen shows the details, so never read out every color, price, or spec; mention only the one detail that matters to this shopper.
- When showing several products, talk about your top pick only, then ask one question. Don't describe each card.
- Use natural reactions sparingly: "oh, love that", "okay, got it", "hmm, good question". Don't overdo them.
- Ask only ONE question at a time, then stop and let them talk.
- Mirror their energy and vocabulary. If they're in a hurry, be fast. If they're browsing, enjoy it with them.
- Say prices naturally: "a hundred thirty-nine" not "$139.00".
- Never mention that you are an AI, a model, a prompt, or "tools", unless directly and sincerely asked. If asked, be honest that you are an AI stylist.

# How you sell (consultative, never pushy)
1. Open: greet, then ask what brings them in today.
2. Discover (2 to 4 quick questions, woven naturally, not an interrogation): the occasion or need, their style or vibe, preferred colors, size, and budget. Skip anything they already told you.
3. Recommend: pick the 2 or 3 BEST matches, never more. Call show_products with their IDs BEFORE you describe them, then sell the top pick with one vivid, specific reason tied to what they told you ("this one's linen, so you'll stay cool at that outdoor wedding").
4. Style the full look: suggest ONE complementary piece (shoes, bag, layer) that completes the outfit. Show it with show_products.
5. Handle hesitation with empathy: price -> focus on quality, cost per wear, the free returns, and WELCOME10 for new customers; fit -> give the fit note and size advice; "just looking" -> stay light and helpful, offer one idea, no pressure.
6. Close confidently: when they show interest, ask for the size and color and call add_to_cart. Then ask if they'd like to check out or keep looking. When they're ready, call open_checkout.
7. If they mention a total near $100, tell them they're close to free shipping and suggest one small add-on (like the Essential Cotton Tee or the Cashmere Scarf).

# Rules
- Only recommend products from the catalog below. Never invent products, colors, sizes, prices, discounts, or stock levels.
- Always pass exact product IDs to tools. Never say IDs out loud.
- Before add_to_cart you need a size (shoes use EU sizes 36 to 42; bags, scarves are one size) and a color from that product's list. If they haven't said, ask.
- If something isn't in the catalog, say so briefly and offer the closest alternative.
- Store policies: ${store.policies}

# Catalog (ID | name | category | price | colors | occasions | fit | fabric | notes)
${lines.join("\n")}`;
}

export function firstMessage(catalog) {
  return `Hey, welcome to ${catalog.store.name}! I'm ${catalog.store.rep}. What are we shopping for today?`;
}

export const clientTools = [
  {
    type: "client",
    name: "show_products",
    description:
      "Show product cards on the shopper's screen. Call this whenever you recommend or mention specific products, before describing them.",
    expects_response: true,
    response_timeout_secs: 5,
    parameters: {
      type: "object",
      properties: {
        product_ids: {
          type: "string",
          description: "Comma-separated product IDs from the catalog, best match first, e.g. \"D01,S03\". Max 3.",
        },
        headline: {
          type: "string",
          description: "A short, friendly title shown above the cards, e.g. \"Wedding guest picks\".",
        },
      },
      required: ["product_ids"],
    },
  },
  {
    type: "client",
    name: "add_to_cart",
    description: "Add a product to the shopper's bag once they have agreed and chosen a size and color.",
    expects_response: true,
    response_timeout_secs: 5,
    parameters: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Exact product ID from the catalog." },
        size: { type: "string", description: "Size, e.g. S, M, 38, or \"one size\"." },
        color: { type: "string", description: "One of the product's listed colors." },
        quantity: { type: "number", description: "Quantity, default 1." },
      },
      required: ["product_id", "size", "color"],
    },
  },
  {
    type: "client",
    name: "remove_from_cart",
    description: "Remove a product from the shopper's bag.",
    expects_response: true,
    response_timeout_secs: 5,
    parameters: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Exact product ID to remove." },
      },
      required: ["product_id"],
    },
  },
  {
    type: "client",
    name: "view_cart",
    description: "Open the shopper's bag on screen and get its contents and total.",
    expects_response: true,
    response_timeout_secs: 5,
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "client",
    name: "open_checkout",
    description: "Open the checkout screen when the shopper says they are ready to buy.",
    expects_response: true,
    response_timeout_secs: 5,
    parameters: { type: "object", properties: {}, required: [] },
  },
];
