const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function generateAgentResponse(
  userMessage: string,
  productContext: string
) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const systemInstruction = `You are AgentPay, an AI shopping assistant.

Rules:
- Recommend ONLY products in the catalog.
- Never invent products, prices, or specifications.
- Use exact product names and prices.
- Consider budget and requirements.
- Give a very short recommendation.
- If multiple products match, compare them briefly.

Catalog:
${productContext}`;

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        model: "gemini-3.6-flash",
        input: userMessage,
        system_instruction: systemInstruction,
        generation_config: {
          max_total_tokens: 80,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Gemini API error ${response.status}: ${errorText}`
    );
  }

  const data = await response.json();

  const reply =
    data?.output_text?.trim() ||
    data?.steps
      ?.find((step: any) => step.type === "model_output")
      ?.content
      ?.find((content: any) => content.type === "text")
      ?.text
      ?.trim();

  if (!reply) {
    throw new Error("Gemini returned an empty response");
  }

  return {
    success: true,
    reply,
  };
}


// =========================================================
// AI CART ACTION DETECTION
// =========================================================

export type AgentAction =
  | {
      type: "ADD";
      productId: number;
      quantity: number;
    }
  | {
      type: "REMOVE";
      productId: number;
    }
  | {
      type: "UPDATE";
      productId: number;
      quantity: number;
    }
  | {
      type: "VIEW";
    }
  | {
      type: "CLEAR";
    }
  | {
      type: "NONE";
    };

export function detectCartAction(
  message: string,
  products: {
    id: number;
    name: string;
  }[]
): AgentAction {
  const text = message
    .toLowerCase()
    .trim();

  // =======================================================
  // VIEW CART
  // =======================================================

  if (
    text.includes("what is in my cart") ||
    text.includes("what's in my cart") ||
    text.includes("show my cart") ||
    text.includes("view cart") ||
    text.includes("my cart") ||
    text.includes("cart items")
  ) {
    return {
      type: "VIEW",
    };
  }

  // =======================================================
  // CLEAR CART
  // =======================================================

  if (
    text.includes("clear cart") ||
    text.includes("empty cart") ||
    text.includes("remove everything") ||
    text.includes("empty my cart")
  ) {
    return {
      type: "CLEAR",
    };
  }

  // =======================================================
  // FIND PRODUCT
  // =======================================================

  const matchedProduct = products.find((product) =>
    text.includes(product.name.toLowerCase())
  );

  if (!matchedProduct) {
    return {
      type: "NONE",
    };
  }

  // =======================================================
  // QUANTITY
  // =======================================================

  const quantityMatch = text.match(/\b(\d+)\b/);

  const quantity = quantityMatch
    ? Number(quantityMatch[1])
    : 1;

  // =======================================================
  // REMOVE
  // =======================================================

  if (
    text.includes("remove") ||
    text.includes("delete") ||
    text.includes("take out")
  ) {
    return {
      type: "REMOVE",
      productId: matchedProduct.id,
    };
  }

  // =======================================================
  // UPDATE QUANTITY
  // =======================================================

  if (
    text.includes("update") ||
    text.includes("change") ||
    text.includes("make it") ||
    text.includes("set quantity")
  ) {
    return {
      type: "UPDATE",
      productId: matchedProduct.id,
      quantity: Math.max(1, quantity),
    };
  }

  // =======================================================
  // ADD
  // =======================================================

  if (
    text.includes("add") ||
    text.includes("buy") ||
    text.includes("get") ||
    text.includes("put")
  ) {
    return {
      type: "ADD",
      productId: matchedProduct.id,
      quantity: Math.max(1, quantity),
    };
  }

  return {
    type: "NONE",
  };
}