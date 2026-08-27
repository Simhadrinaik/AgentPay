import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import crypto from "crypto";

import { products } from "./products";
import {
  generateAgentResponse,
  detectCartAction,
} from "./ai";

import {
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  getCart,
} from "./cart";

import { razorpay } from "./payment";
import { prisma } from "./prisma";

import {
  registerUser,
  loginUser,
  getUserById,
  verifyAuthToken,
} from "./auth";

dotenv.config();

// =========================================================
// AUTH HELPER
// =========================================================

function getAuthenticatedUserId(
  request: any
): string | null {
  const authorization =
    request.headers.authorization;

  if (!authorization) {
    return null;
  }

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token =
    authorization.slice(7).trim();

  if (!token) {
    return null;
  }

  const decoded =
    verifyAuthToken(token);

  return decoded?.userId ?? null;
}

const app = Fastify({
  logger: true,
});

// =========================================================
// AUTH - REGISTER
// =========================================================

app.post(
  "/api/auth/register",
  async (request, reply) => {
    try {
      const body = request.body as {
        name?: string;
        email?: string;
        password?: string;
      };

      const result =
        await registerUser(body);

      if (!result.success) {
        return reply.code(400).send(result);
      }

      return reply.code(201).send(result);
    } catch (error) {
      app.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Registration failed",
      });
    }
  }
);

// =========================================================
// AUTH - LOGIN
// =========================================================

app.post(
  "/api/auth/login",
  async (request, reply) => {
    try {
      const body = request.body as {
        email?: string;
        password?: string;
      };

      const result =
        await loginUser(body);

      if (!result.success) {
        return reply.code(401).send(result);
      }

      return reply.send(result);
    } catch (error) {
      app.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Login failed",
      });
    }
  }
);

// =========================================================
// AUTH - CURRENT USER
// =========================================================

app.get(
  "/api/auth/me",
  async (request, reply) => {
    try {
      const userId =
        getAuthenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({
          success: false,
          message: "Authentication required",
        });
      }

      const result =
        await getUserById(userId);

      if (!result.success) {
        return reply.code(404).send(result);
      }

      return reply.send(result);
    } catch (error) {
      app.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Failed to get user",
      });
    }
  }
);

// =========================================================
// PRODUCT SEARCH
// =========================================================

const searchProducts = (
  message: string
) => {
  const text = message.toLowerCase();

  let category = "";

  if (
    text.includes("phone") ||
    text.includes("smartphone") ||
    text.includes("mobile")
  ) {
    category = "smartphone";
  } else if (
    text.includes("laptop")
  ) {
    category = "laptop";
  } else if (
    text.includes("headphone") ||
    text.includes("headphones")
  ) {
    category = "headphones";
  } else if (
    text.includes("mouse")
  ) {
    category = "accessory";
  }

  const normalizedText =
    text.replace(/,/g, "");

  const kMatch =
    normalizedText.match(
      /(\d+(?:\.\d+)?)\s*k/
    );

  const numberMatch =
    normalizedText.match(/\d+/);

  let budget = Infinity;

  if (kMatch) {
    budget =
      Number(kMatch[1]) * 1000;
  } else if (numberMatch) {
    budget =
      Number(numberMatch[0]);
  }

  return products.filter(
    (product) => {
      const categoryMatch =
        category
          ? product.category === category
          : true;

      const budgetMatch =
        product.price <= budget;

      return (
        categoryMatch &&
        budgetMatch
      );
    }
  );
};

// =========================================================
// SMART UPSELL ENGINE
// =========================================================

const getUpsellProducts = (
  selectedProduct:
    (typeof products)[number]
) => {
  const category =
    selectedProduct.category;

  if (
    category === "smartphone"
  ) {
    return products.filter(
      (product) =>
        product.category ===
          "headphones" &&
        product.id !==
          selectedProduct.id
    );
  }

  if (
    category === "laptop"
  ) {
    return products.filter(
      (product) =>
        product.category ===
          "accessory" &&
        product.id !==
          selectedProduct.id
    );
  }

  if (
    category === "headphones"
  ) {
    return products.filter(
      (product) =>
        product.category ===
          "accessory" &&
        product.id !==
          selectedProduct.id
    );
  }

  return [];
};

// =========================================================
// START SERVER
// =========================================================

const startServer = async () => {
  try {
    // =====================================================
    // CORS
    // =====================================================

    await app.register(cors, {
      origin: true,
    });

    // =====================================================
    // HOME
    // =====================================================

    app.get("/", async () => {
      return {
        success: true,
        message:
          "AgentPay API is running 🚀",
      };
    });

    // =====================================================
    // HEALTH
    // =====================================================

    app.get(
      "/api/health",
      async () => {
        return {
          status: "healthy",
          service:
            "agentpay-backend",
        };
      }
    );

    // =====================================================
    // PRODUCT CATALOG
    // =====================================================

    app.get(
      "/api/products",
      async () => {
        return {
          success: true,
          count: products.length,
          products,
        };
      }
    );

    // =====================================================
    // FAST PRODUCT SEARCH
    // =====================================================
    // This endpoint does NOT call Ollama.
    // It returns matching products immediately so the
    // frontend does not have to wait for AI generation.
    // =====================================================

    app.post(
      "/api/search",
      async (request, reply) => {
        try {
          const body =
            request.body as {
              message?: string;
            };

          const message =
            body.message?.trim();

          if (!message) {
            return reply.code(400).send({
              success: false,
              message:
                "Message is required",
            });
          }

          const matchingProducts =
            searchProducts(message);

          if (
            matchingProducts.length === 0
          ) {
            return {
              success: true,
              products: [],
              selectedProduct: null,
              upsells: [],
              message:
                "I couldn't find a product matching your request. Try changing your category or budget.",
            };
          }

          const selectedProduct =
            matchingProducts[0];

          const upsells =
            getUpsellProducts(
              selectedProduct
            );

          return {
            success: true,
            products:
              matchingProducts,
            selectedProduct,
            upsells,
          };
        } catch (error) {
          app.log.error(error);

          return reply.code(500).send({
            success: false,
            message:
              "Product search failed",
          });
        }
      }
    );

    // =====================================================
    // AI CART ACTION
    // =====================================================

    app.post(
      "/api/agent/action",
      async (request, reply) => {
        try {
          const userId = getAuthenticatedUserId(request);
          if (!userId) return reply.code(401).send({ success: false, message: "Authentication required" });

          const body = request.body as { message?: string };
          const message = body.message?.trim();
          if (!message) return reply.code(400).send({ success: false, message: "Message is required" });

          const action = detectCartAction(message, products);

          if (action.type === "NONE") return { success: true, action: "NONE", message: "I couldn't understand the cart action." };
          if (action.type === "VIEW") return { success: true, action: "VIEW", cart: await getCart(userId) };
          if (action.type === "CLEAR") return { success: true, action: "CLEAR", message: "Your cart has been cleared.", cart: await clearCart(userId) };

          if (action.type === "ADD") {
            const result = await addToCart(userId, action.productId, action.quantity);
            if (!result.success) return reply.code(400).send({ success: false, action: "ADD", message: "Failed to add product to cart" });
            const product = products.find(p => p.id === action.productId);
            return { success: true, action: "ADD", product, quantity: action.quantity, message: product ? `${product.name} added to your cart.` : "Product added to your cart.", cart: result };
          }

          if (action.type === "REMOVE") {
            const result = await removeFromCart(userId, action.productId);
            if (!result.success) return reply.code(400).send({ success: false, action: "REMOVE", message: "Failed to remove product from cart" });
            const product = products.find(p => p.id === action.productId);
            return { success: true, action: "REMOVE", product, message: product ? `${product.name} removed from your cart.` : "Product removed from your cart.", cart: result };
          }

          if (action.type === "UPDATE") {
            const result = await updateCartQuantity(userId, action.productId, action.quantity);
            if (!result.success) return reply.code(400).send({ success: false, action: "UPDATE", message: "Failed to update cart quantity" });
            const product = products.find(p => p.id === action.productId);
            return { success: true, action: "UPDATE", product, quantity: action.quantity, message: product ? `${product.name} quantity updated to ${action.quantity}.` : "Cart quantity updated.", cart: result };
          }

          return { success: true, action: "NONE" };
        } catch (error) {
          app.log.error(error);
          return reply.code(500).send({ success: false, message: "Failed to process cart action" });
        }
      }
    );

    // =====================================================
    // AI CHAT
    // =====================================================

    app.post(
      "/api/chat",
      async (request, reply) => {
        const body =
          request.body as {
            message?: string;
          };

        const message =
          body.message?.trim();

        if (!message) {
          return reply.code(400).send({
            success: false,
            message:
              "Message is required",
          });
        }

        const matchingProducts =
          searchProducts(message);

        if (
          matchingProducts.length ===
          0
        ) {
          return {
            success: true,
            reply:
              "I couldn't find a product matching your request. Try changing your category or budget.",
            products: [],
            selectedProduct: null,
            upsells: [],
          };
        }

        const productContext =
          matchingProducts
            .map(
              (product) =>
                `${product.name} | ₹${product.price} | ${product.description} | Tags: ${product.tags.join(", ")}`
            )
            .join("\n");

        const aiResponse =
          await generateAgentResponse(
            message,
            productContext
          );

        const selectedProduct =
          matchingProducts[0];

        const upsells =
          getUpsellProducts(
            selectedProduct
          );

        return {
          success:
            aiResponse.success,
          reply:
            aiResponse.reply,
          products:
            matchingProducts,
          selectedProduct,
          upsells,
        };
      }
    );

    // =====================================================
    // CART - GET
    // =====================================================

    app.get(
      "/api/cart",
      async (request, reply) => {
        try {
          const userId =
            getAuthenticatedUserId(request);

          if (!userId) {
            return reply.code(401).send({
              success: false,
              message: "Authentication required",
            });
          }

          return {
            success: true,
            cart: await getCart(userId),
          };
        } catch (error) {
          app.log.error(error);

          return reply.code(500).send({
            success: false,
            message: "Failed to fetch cart",
          });
        }
      }
    );

    // =====================================================
    // CART - ADD
    // =====================================================

    app.post(
      "/api/cart/add",
      async (request, reply) => {
        try {
          const userId =
            getAuthenticatedUserId(request);

          if (!userId) {
            return reply.code(401).send({
              success: false,
              message: "Authentication required",
            });
          }

          const body =
            request.body as {
              productId?: number;
              quantity?: number;
            };

          if (
            body.productId ===
            undefined
          ) {
            return reply.code(400).send({
              success: false,
              message:
                "productId is required",
            });
          }

          if (
            !Number.isInteger(body.productId) ||
            body.productId <= 0
          ) {
            return reply.code(400).send({
              success: false,
              message:
                "productId must be a valid number",
            });
          }

          return await addToCart(
            userId,
            body.productId,
            body.quantity ?? 1
          );
        } catch (error) {
          app.log.error(error);

          return reply.code(500).send({
            success: false,
            message: "Failed to add product to cart",
          });
        }
      }
    );

    // =====================================================
    // CART - UPDATE QUANTITY
    // =====================================================

    app.post(
      "/api/cart/update",
      async (request, reply) => {
        try {
          const userId =
            getAuthenticatedUserId(request);

          if (!userId) {
            return reply.code(401).send({
              success: false,
              message: "Authentication required",
            });
          }

          const body =
            request.body as {
              productId?: number;
              quantity?: number;
            };

          if (
            body.productId ===
              undefined ||
            body.quantity ===
              undefined
          ) {
            return reply.code(400).send({
              success: false,
              message:
                "productId and quantity are required",
            });
          }

          if (
            !Number.isInteger(
              body.productId
            ) ||
            body.productId <= 0
          ) {
            return reply.code(400).send({
              success: false,
              message:
                "productId must be a valid number",
            });
          }

          if (
            !Number.isInteger(
              body.quantity
            ) ||
            body.quantity < 0
          ) {
            return reply.code(400).send({
              success: false,
              message:
                "quantity must be a non-negative whole number",
            });
          }

          return await updateCartQuantity(
            userId,
            body.productId,
            body.quantity
          );
        } catch (error) {
          app.log.error(error);

          return reply.code(500).send({
            success: false,
            message: "Failed to update cart",
          });
        }
      }
    );

    // =====================================================
    // CART - REMOVE
    // =====================================================

    app.post(
      "/api/cart/remove",
      async (request, reply) => {
        try {
          const userId =
            getAuthenticatedUserId(request);

          if (!userId) {
            return reply.code(401).send({
              success: false,
              message: "Authentication required",
            });
          }

          const body =
            request.body as {
              productId?: number;
            };

          if (
            body.productId ===
            undefined
          ) {
            return reply.code(400).send({
              success: false,
              message:
                "productId is required",
            });
          }

          if (
            !Number.isInteger(body.productId) ||
            body.productId <= 0
          ) {
            return reply.code(400).send({
              success: false,
              message:
                "productId must be a valid number",
            });
          }

          return await removeFromCart(
            userId,
            body.productId
          );
        } catch (error) {
          app.log.error(error);

          return reply.code(500).send({
            success: false,
            message: "Failed to remove product from cart",
          });
        }
      }
    );

    // =====================================================
    // CART - CLEAR
    // =====================================================

    app.post(
      "/api/cart/clear",
      async (request, reply) => {
        try {
          const userId =
            getAuthenticatedUserId(request);

          if (!userId) {
            return reply.code(401).send({
              success: false,
              message: "Authentication required",
            });
          }

          return {
            success: true,
            cart: await clearCart(userId),
          };
        } catch (error) {
          app.log.error(error);

          return reply.code(500).send({
            success: false,
            message: "Failed to clear cart",
          });
        }
      }
    );

    // =====================================================
    // RAZORPAY - CREATE ORDER
    // =====================================================

    app.post(
      "/api/payment/create-order",
      async (request, reply) => {
        try {
          const userId =
            getAuthenticatedUserId(request);

          if (!userId) {
            return reply.code(401).send({
              success: false,
              message: "Authentication required",
            });
          }

          const cart = await getCart(userId);

          if (
            cart.itemCount === 0
          ) {
            return reply.code(400).send({
              success: false,
              message:
                "Cart is empty",
            });
          }

          // Razorpay uses paise
          const amount =
            cart.subtotal * 100;

          const order =
            await razorpay.orders.create({
              amount,
              currency: "INR",
              receipt:
                `agentpay_${Date.now()}`,
            });

          return {
            success: true,

            order: {
              id: order.id,
              amount:
                order.amount,
              currency:
                order.currency,
            },

            keyId:
              process.env
                .RAZORPAY_KEY_ID,

            cart,
          };
        } catch (error) {
          app.log.error(error);

          return reply.code(500).send({
            success: false,
            message:
              "Failed to create Razorpay order",
          });
        }
      }
    );

    // =====================================================
    // RAZORPAY - VERIFY PAYMENT + SAVE ORDER
    // =====================================================

    app.post(
      "/api/payment/verify",
      async (request, reply) => {
        try {
          // -------------------------------------------------
          // AUTHENTICATION
          // -------------------------------------------------

          const userId =
            getAuthenticatedUserId(
              request
            );

          if (!userId) {
            return reply.code(401).send({
              success: false,
              verified: false,
              message:
                "Authentication required",
            });
          }

          // -------------------------------------------------
          // PAYMENT DATA
          // -------------------------------------------------

          const body =
            request.body as {
              razorpay_order_id?: string;
              razorpay_payment_id?: string;
              razorpay_signature?: string;
            };

          const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
          } = body;

          if (
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature
          ) {
            return reply.code(400).send({
              success: false,
              verified: false,
              message:
                "Payment verification data is missing",
            });
          }

          // -------------------------------------------------
          // RAZORPAY SECRET
          // -------------------------------------------------

          const secret =
            process.env
              .RAZORPAY_KEY_SECRET;

          if (!secret) {
            return reply.code(500).send({
              success: false,
              verified: false,
              message:
                "Razorpay secret is not configured",
            });
          }

          // -------------------------------------------------
          // GENERATE SIGNATURE
          // -------------------------------------------------

          const generatedSignature =
            crypto
              .createHmac(
                "sha256",
                secret
              )
              .update(
                `${razorpay_order_id}|${razorpay_payment_id}`
              )
              .digest("hex");

          // -------------------------------------------------
          // VERIFY SIGNATURE
          // -------------------------------------------------

          if (
            generatedSignature.length !==
            razorpay_signature.length
          ) {
            return reply.code(400).send({
              success: false,
              verified: false,
              message:
                "Invalid payment signature",
            });
          }

          const isValid =
            crypto.timingSafeEqual(
              Buffer.from(
                generatedSignature
              ),
              Buffer.from(
                razorpay_signature
              )
            );

          if (!isValid) {
            return reply.code(400).send({
              success: false,
              verified: false,
              message:
                "Invalid payment signature",
            });
          }

          // -------------------------------------------------
          // CHECK DUPLICATE PAYMENT
          // -------------------------------------------------

          const existingOrder =
            await prisma.order.findUnique({
              where: {
                razorpayPaymentId:
                  razorpay_payment_id,
              },

              include: {
                items: true,
              },
            });

          if (existingOrder) {
            // Payment belongs to another user
            if (
              existingOrder.userId !==
              userId
            ) {
              return reply.code(403).send({
                success: false,
                verified: true,
                alreadySaved: true,
                message:
                  "This payment belongs to another user",
              });
            }

            // Payment already belongs
            // to current user
            return {
              success: true,
              verified: true,
              alreadySaved: true,
              message:
                "Payment already saved",
              order: existingOrder,
            };
          }

          // -------------------------------------------------
          // GET CART
          // -------------------------------------------------

          const cart = await getCart(userId);

          if (
            cart.itemCount === 0
          ) {
            return reply.code(400).send({
              success: false,
              verified: true,
              message:
                "Payment verified but cart is empty",
            });
          }

          // -------------------------------------------------
          // SAVE ORDER
          // -------------------------------------------------

          const savedOrder =
            await prisma.order.create({
              data: {
                razorpayOrderId:
                  razorpay_order_id,

                razorpayPaymentId:
                  razorpay_payment_id,

                amount:
                  cart.subtotal,

                currency: "INR",

                status: "PAID",

                // IMPORTANT
                // Logged-in user ID
                userId: userId,

                items: {
                  create:
                    cart.items.map(
                      (item) => ({
                        productId:
                          item.product.id,

                        productName:
                          item.product.name,

                        price:
                          item.product.price,

                        quantity:
                          item.quantity,

                        itemTotal:
                          item.itemTotal,
                      })
                    ),
                },
              },

              include: {
                items: true,
              },
            });

          // -------------------------------------------------
          // CLEAR CART
          // -------------------------------------------------

          await clearCart(userId);

          // -------------------------------------------------
          // SUCCESS
          // -------------------------------------------------

          return {
            success: true,
            verified: true,
            alreadySaved: false,
            message:
              "Payment verified and order saved successfully",
            order: savedOrder,
          };
        } catch (error) {
          app.log.error(error);

          return reply.code(500).send({
            success: false,
            verified: false,
            message:
              "Payment verification failed",
          });
        }
      }
    );

    // =====================================================
    // MY ORDER HISTORY
    // =====================================================

    app.get(
      "/api/orders",
      async (request, reply) => {
        try {
          const userId =
            getAuthenticatedUserId(
              request
            );

          if (!userId) {
            return reply.code(401).send({
              success: false,
              message:
                "Authentication required",
            });
          }

          const orders =
            await prisma.order.findMany({
              where: {
                userId: userId,
              },

              include: {
                items: true,
              },

              orderBy: {
                createdAt: "desc",
              },
            });

          return {
            success: true,
            count:
              orders.length,
            orders,
          };
        } catch (error) {
          app.log.error(error);

          return reply.code(500).send({
            success: false,
            message:
              "Failed to fetch order history",
          });
        }
      }
    );

    // =====================================================
    // SINGLE USER ORDER
    // =====================================================

    app.get(
      "/api/orders/:id",
      async (request, reply) => {
        try {
          const userId =
            getAuthenticatedUserId(
              request
            );

          if (!userId) {
            return reply.code(401).send({
              success: false,
              message:
                "Authentication required",
            });
          }

          const params =
            request.params as {
              id: string;
            };

          const order =
            await prisma.order.findFirst({
              where: {
                id: params.id,
                userId: userId,
              },

              include: {
                items: true,
              },
            });

          if (!order) {
            return reply.code(404).send({
              success: false,
              message:
                "Order not found",
            });
          }

          return {
            success: true,
            order,
          };
        } catch (error) {
          app.log.error(error);

          return reply.code(500).send({
            success: false,
            message:
              "Failed to fetch order",
          });
        }
      }
    );

    // =====================================================
    // START SERVER
    // =====================================================

    const PORT =
      Number(
        process.env.PORT
      ) || 5000;

    await app.listen({
      port: PORT,
      host: "0.0.0.0",
    });

    console.log(
      `🚀 AgentPay backend running on port ${PORT}`
    );
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

startServer();