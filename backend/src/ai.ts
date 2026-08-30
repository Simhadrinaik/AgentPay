// =========================================================
// GEMINI AI
// =========================================================

export async function generateAgentResponse(
  userMessage: string,
  productContext: string
) {
  // Read the environment variable when the function runs.
  // Do NOT keep it as a module-level constant.
  const GEMINI_API_KEY =
    process.env.GEMINI_API_KEY?.trim();

  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not configured"
    );
  }

  const systemInstruction = `You are AgentPay, an AI shopping assistant.

Rules:
- Recommend ONLY products in the catalog.
- Never invent products, prices, or specifications.
- Use exact product names and prices from the catalog.
- Consider the user's budget and requirements.
- Keep the recommendation short and useful.
- If multiple products match, compare them briefly.
- If no product matches, clearly say that no matching product was found.
- Never claim a product exists if it is not in the catalog.

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
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Gemini API error ${response.status}: ${errorText}`
    );
  }

  const data: any = await response.json();

  // =======================================================
  // GET GEMINI RESPONSE
  // =======================================================

  let reply = "";

  // Preferred Interactions API output
  if (
    typeof data?.output_text === "string" &&
    data.output_text.trim()
  ) {
    reply = data.output_text.trim();
  }

  // Fallback: read model_output steps
  if (!reply && Array.isArray(data?.steps)) {
    for (const step of data.steps) {
      if (step?.type !== "model_output") {
        continue;
      }

      if (!Array.isArray(step?.content)) {
        continue;
      }

      for (const content of step.content) {
        if (
          content?.type === "text" &&
          typeof content?.text === "string"
        ) {
          reply = content.text.trim();

          if (reply) {
            break;
          }
        }
      }

      if (reply) {
        break;
      }
    }
  }

  if (!reply) {
    throw new Error(
      "Gemini returned an empty response"
    );
  }

  return {
    success: true,
    reply,
  };
}


// =========================================================
// AI CART ACTION TYPES
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


// =========================================================
// AI CART ACTION DETECTION
// =========================================================

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
    text === "my cart" ||
    text.includes("cart items") ||
    text.includes("show cart")
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
    text.includes("empty my cart") ||
    text.includes("delete everything from cart")
  ) {
    return {
      type: "CLEAR",
    };
  }


  // =======================================================
  // FIND PRODUCT
  // =======================================================

  const matchedProduct = products.find(
    (product) =>
      text.includes(
        product.name.toLowerCase()
      )
  );

  // Product not found
  if (!matchedProduct) {
    return {
      type: "NONE",
    };
  }


  // =======================================================
  // QUANTITY
  // =======================================================

  const quantityMatch =
    text.match(/\b(\d+)\b/);

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
    text.includes("set quantity") ||
    text.includes("increase") ||
    text.includes("decrease")
  ) {
    return {
      type: "UPDATE",
      productId: matchedProduct.id,
      quantity: Math.max(1, quantity),
    };
  }


  // =======================================================
  // ADD TO CART
  // =======================================================

  if (
    text.includes("add") ||
    text.includes("buy") ||
    text.includes("purchase") ||
    text.includes("get") ||
    text.includes("put") ||
    text.includes("order")
  ) {
    return {
      type: "ADD",
      productId: matchedProduct.id,
      quantity: Math.max(1, quantity),
    };
  }


  // =======================================================
  // NO ACTION
  // =======================================================

  return {
    type: "NONE",
  };
}