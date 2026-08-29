import { useEffect, useState } from "react";
import {
  Send,
  ShoppingCart,
  Sparkles,
  Plus,
  Trash2,
  CreditCard,
  CheckCircle,
  ArrowLeft,
  Package,
} from "lucide-react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;

declare global {
  interface Window {
    Razorpay: any;
  }
}

// =========================================================
// TYPES
// =========================================================

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  tags: string[];
  image: string;
};

type CartItem = {
  product: Product;
  quantity: number;
  itemTotal: number;
};

type OrderItem = {
  id: string;
  productId: number;
  productName: string;
  price: number;
  quantity: number;
  itemTotal: number;
};

type Order = {
  id: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  userId?: string;
  items: OrderItem[];
};

// =========================================================
// APP
// =========================================================

function App() {
  // =======================================================
  // AUTH
  // =======================================================

  const getToken = () => {
    return localStorage.getItem("token");
  };

  const authHeaders = (): Record<string, string> => {
    const token = getToken();

    if (token) {
      return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
    }

    return {
      "Content-Type": "application/json",
    };
  };

  // =======================================================
  // AUTH STATE
  // =======================================================

  const [isAuthenticated, setIsAuthenticated] =
    useState<boolean>(!!localStorage.getItem("token"));

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [showRegister, setShowRegister] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");

  // =======================================================
  // AI
  // =======================================================

  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);
  const [upsells, setUpsells] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // =======================================================
  // CART
  // =======================================================

  const [cart, setCart] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);

  // =======================================================
  // PAYMENT
  // =======================================================

  const [paymentLoading, setPaymentLoading] =
    useState(false);

  const [paymentSuccess, setPaymentSuccess] =
    useState(false);

  const [paymentId, setPaymentId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);

  const [showCheckout, setShowCheckout] = useState(false);

  // =======================================================
  // ORDER HISTORY
  // =======================================================

  const [showOrders, setShowOrders] =
    useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] =
    useState(false);

  // =======================================================
  // FORMAT PRICE
  // =======================================================

  const formatPrice = (price: number) => {
    return `₹${price.toLocaleString("en-IN")}`;
  };

  // =======================================================
  // LOGIN
  // =======================================================

  const loginUser = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError("Please enter email and password.");
      return;
    }

    setLoginLoading(true);
    setLoginError("");

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.token) {
        throw new Error(data.message || "Login failed.");
      }

      localStorage.setItem("token", data.token);
      setIsAuthenticated(true);
      setLoginPassword("");
      setLoginError("");
    } catch (error) {
      console.error("Login error:", error);
      setLoginError(
        error instanceof Error ? error.message : "Unable to login."
      );
    } finally {
      setLoginLoading(false);
    }
  };

  // =======================================================
  // REGISTER
  // =======================================================

  const registerUser = async () => {
    if (
      !registerName.trim() ||
      !registerEmail.trim() ||
      !registerPassword.trim()
    ) {
      setRegisterError("Please fill all fields.");
      return;
    }

    setRegisterLoading(true);
    setRegisterError("");

    try {
      const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: registerName.trim(),
            email: registerEmail.trim(),
            password: registerPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success || !data.token) {
        throw new Error(
          data.message || "Registration failed."
        );
      }

      localStorage.setItem("token", data.token);
      setIsAuthenticated(true);
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterError("");
    } catch (error) {
      console.error("Registration error:", error);
      setRegisterError(
        error instanceof Error
          ? error.message
          : "Unable to create account."
      );
    } finally {
      setRegisterLoading(false);
    }
  };

  // =======================================================
  // LOGOUT
  // =======================================================

  const logoutUser = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setOrders([]);
    setCart([]);
    setSubtotal(0);
    setPaymentSuccess(false);
    setShowOrders(false);
  };

  // =======================================================
  // FETCH CART
  // =======================================================

  const fetchCart = async () => {
    const token = getToken();

    if (!token) {
      setCart([]);
      setSubtotal(0);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/cart`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to fetch cart");
      }

      const cartData = data.cart || data;
      setCart(cartData.items || []);
      setSubtotal(cartData.subtotal || 0);
    } catch (error) {
      console.error("Cart fetch error:", error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
    }
  }, [isAuthenticated]);

  // =======================================================
  // FETCH ORDERS
  // =======================================================

  const fetchOrders = async () => {
    setOrdersLoading(true);

    try {
      const token = getToken();

      if (!token) {
        alert("Please login first.");
        setOrders([]);
        return;
      }

      const response = await fetch(
        `${API_URL}/api/orders`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Failed to fetch orders"
        );
      }

      setOrders(data.orders || []);
    } catch (error) {
      console.error(
        "Order history error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to load order history."
      );
    } finally {
      setOrdersLoading(false);
    }
  };

  // =======================================================
  // ASK AI AGENT - FAST SEARCH + AI RESPONSE
  // =======================================================
  // Product search is done first through /api/search.
  // This endpoint does NOT call Ollama, so products appear
  // immediately instead of waiting for AI generation.
  //
  // Then /api/chat is called for the AI recommendation.
  // Both requests are started together for better speed.
  // =======================================================

  const askAgent = async () => {
    const userMessage = message.trim();

    if (!userMessage || loading) return;

    setLoading(true);
    setReply("");
    setProducts([]);
    setSelectedProduct(null);
    setUpsells([]);

    try {
      const headers = authHeaders();

      const searchPromise = fetch(
        `${API_URL}/api/search`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: userMessage,
          }),
        }
      );

      const chatPromise = fetch(
        `${API_URL}/api/chat`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: userMessage,
          }),
        }
      );

      // Wait for fast catalog search first.
      // This lets the UI receive product cards as soon
      // as the local backend search finishes.
      const searchResponse =
        await searchPromise;

      const searchData =
        await searchResponse.json();

      if (!searchResponse.ok) {
        throw new Error(
          searchData.message ||
            "Product search failed"
        );
      }

      setProducts(
        searchData.products || []
      );

      setSelectedProduct(
        searchData.selectedProduct ||
          null
      );

      setUpsells(
        searchData.upsells || []
      );

      // AI response can take longer because Ollama
      // generates the recommendation separately.
      const chatResponse =
        await chatPromise;

      const chatData =
        await chatResponse.json();

      if (!chatResponse.ok) {
        throw new Error(
          chatData.message ||
            "Agent request failed"
        );
      }

      setReply(
        chatData.reply || ""
      );

      // Keep backend AI results authoritative if
      // they contain product information.
      if (
        Array.isArray(chatData.products) &&
        chatData.products.length > 0
      ) {
        setProducts(
          chatData.products
        );
      }

      if (chatData.selectedProduct) {
        setSelectedProduct(
          chatData.selectedProduct
        );
      }

      if (
        Array.isArray(chatData.upsells)
      ) {
        setUpsells(
          chatData.upsells
        );
      }
    } catch (error) {
      console.error(
        "Agent search error:",
        error
      );

      setReply(
        error instanceof Error
          ? error.message
          : "Unable to connect to AgentPay backend."
      );

      setProducts([]);
      setSelectedProduct(null);
      setUpsells([]);
    } finally {
      setLoading(false);
    }
  };

  // =======================================================
  // ADD TO CART
  // =======================================================

  const addToCart = async (
    productId: number
  ) => {
    try {
      const token = getToken();

      if (!token) {
        alert("Please login first.");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/cart/add`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            productId,
            quantity: 1,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to add product"
        );
      }

      setCart(data.items || []);
      setSubtotal(data.subtotal || 0);
    } catch (error) {
      console.error("Add to cart error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Unable to add product to cart."
      );
    }
  };

  // =======================================================
  // UPDATE CART QUANTITY
  // =======================================================

  const updateCartQuantity = async (
    productId: number,
    quantity: number
  ) => {
    if (quantity < 1) {
      await removeFromCart(productId);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/cart/update`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            productId,
            quantity,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to update quantity"
        );
      }

      setCart(data.items || []);
      setSubtotal(data.subtotal || 0);
    } catch (error) {
      console.error(error);

      alert(
        "Unable to update cart quantity."
      );
    }
  };

  // =======================================================
  // REMOVE FROM CART
  // =======================================================

  const removeFromCart = async (
    productId: number
  ) => {
    try {
      const response = await fetch(
        `${API_URL}/api/cart/remove`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            productId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to remove product"
        );
      }

      setCart(data.items || []);
      setSubtotal(data.subtotal || 0);
    } catch (error) {
      console.error(error);

      alert(
        "Unable to remove product."
      );
    }
  };

  // =======================================================
  // CLEAR CART
  // =======================================================

  const clearCart = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/cart/clear`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to clear cart"
        );
      }

      setCart([]);
      setSubtotal(0);
    } catch (error) {
      console.error(error);

      alert(
        "Unable to clear cart."
      );
    }
  };

  // =======================================================
  // PAYMENT
  // =======================================================

  const startPayment = async () => {
    if (cart.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    // IMPORTANT:
    // Payment verification requires
    // logged-in user's JWT token.
    const token = getToken();

    if (!token) {
      alert(
        "Please login before making a payment."
      );
      return;
    }

    setPaymentLoading(true);
    setShowCheckout(false);

    try {
      // ---------------------------------------------------
      // CREATE RAZORPAY ORDER
      // ---------------------------------------------------

      const response = await fetch(
        `${API_URL}/api/payment/create-order`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to create payment order."
        );
      }

      if (!window.Razorpay) {
        alert(
          "Razorpay Checkout is not loaded. Refresh the page."
        );

        return;
      }

      // ---------------------------------------------------
      // RAZORPAY OPTIONS
      // ---------------------------------------------------

      const options = {
        key: data.keyId,

        amount: data.order.amount,

        currency:
          data.order.currency,

        name: "AgentPay",

        description:
          "AI Commerce Purchase",

        order_id: data.order.id,

        theme: {
          color: "#6366f1",
        },

        prefill: {
          name: "AgentPay Customer",
        },

        notes: {
          source:
            "AgentPay AI Commerce",
        },

        // -------------------------------------------------
        // PAYMENT SUCCESS
        // -------------------------------------------------

        handler: async (
          paymentResponse: any
        ) => {
          try {
            // Get latest token
            const token =
              getToken();

            if (!token) {
              alert(
                "Payment completed, but login token was not found. Please login again."
              );

              return;
            }

            // -------------------------------------------------
            // VERIFY PAYMENT
            // -------------------------------------------------

            const verifyResponse =
              await fetch(
                `${API_URL}/api/payment/verify`,
                {
                  method: "POST",

                  headers: {
                    "Content-Type":
                      "application/json",

                    // IMPORTANT
                    // Send JWT so backend can
                    // identify the user.
                    Authorization: `Bearer ${token}`,
                  },

                  body: JSON.stringify({
                    razorpay_order_id:
                      paymentResponse.razorpay_order_id,

                    razorpay_payment_id:
                      paymentResponse.razorpay_payment_id,

                    razorpay_signature:
                      paymentResponse.razorpay_signature,
                  }),
                }
              );

            const verifyData =
              await verifyResponse.json();

            if (
              !verifyResponse.ok ||
              !verifyData.verified
            ) {
              alert(
                verifyData.message ||
                  "Payment verification failed."
              );

              return;
            }

            // -------------------------------------------------
            // SAVED ORDER
            // -------------------------------------------------

            const savedOrder =
              verifyData.order;

            const finalOrderId =
              savedOrder?.razorpayOrderId ||
              paymentResponse.razorpay_order_id;

            const finalPaymentId =
              savedOrder?.razorpayPaymentId ||
              paymentResponse.razorpay_payment_id;

            const finalAmount =
              savedOrder?.amount ??
              subtotal;

            setOrderId(
              finalOrderId
            );

            setPaymentId(
              finalPaymentId
            );

            setPaidAmount(
              finalAmount
            );

            // -------------------------------------------------
            // REFRESH ORDERS
            // -------------------------------------------------

            await fetchOrders();

            // -------------------------------------------------
            // SUCCESS SCREEN
            // -------------------------------------------------

            setPaymentSuccess(true);

            setCart([]);
            setSubtotal(0);
          } catch (error) {
            console.error(
              "Payment verification error:",
              error
            );

            alert(
              "Payment completed, but verification failed."
            );
          }
        },

        // ---------------------------------------------------
        // MODAL
        // ---------------------------------------------------

        modal: {
          ondismiss: () => {
            console.log(
              "Razorpay checkout closed."
            );
          },
        },
      };

      // -----------------------------------------------------
      // OPEN RAZORPAY
      // -----------------------------------------------------

      const razorpay =
        new window.Razorpay(options);

      razorpay.on(
        "payment.failed",
        (response: any) => {
          console.error(
            "Payment failed:",
            response
          );

          alert(
            response?.error
              ?.description ||
              "Payment failed. Please try again."
          );
        }
      );

      razorpay.open();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Unable to start payment."
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  // =======================================================
  // CONTINUE SHOPPING
  // =======================================================

  const continueShopping = () => {
    setPaymentSuccess(false);
    setShowOrders(false);
  };

  // =======================================================
  // LOGIN / REGISTER SCREEN
  // =======================================================

  if (!isAuthenticated) {
    return (
      <div className="app">
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              padding: "32px",
              borderRadius: "20px",
              background: "#ffffff",
              boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <div
                className="brand-icon"
                style={{
                  width: "52px",
                  height: "52px",
                  margin: "0 auto 14px",
                }}
              >
                <Sparkles size={24} />
              </div>

              <h1>AgentPay</h1>
              <p>
                {showRegister
                  ? "Create your account"
                  : "Login to continue shopping"}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {showRegister && (
                <input
                  type="text"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #ddd",
                    fontSize: "16px",
                    boxSizing: "border-box",
                  }}
                />
              )}

              <input
                type="email"
                value={showRegister ? registerEmail : loginEmail}
                onChange={(e) =>
                  showRegister
                    ? setRegisterEmail(e.target.value)
                    : setLoginEmail(e.target.value)
                }
                placeholder="Email"
                autoComplete="email"
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid #ddd",
                  fontSize: "16px",
                  boxSizing: "border-box",
                }}
              />

              <input
                type="password"
                value={
                  showRegister ? registerPassword : loginPassword
                }
                onChange={(e) =>
                  showRegister
                    ? setRegisterPassword(e.target.value)
                    : setLoginPassword(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    showRegister ? registerUser() : loginUser();
                  }
                }}
                placeholder="Password"
                autoComplete={
                  showRegister ? "new-password" : "current-password"
                }
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid #ddd",
                  fontSize: "16px",
                  boxSizing: "border-box",
                }}
              />

              {(showRegister ? registerError : loginError) && (
                <p
                  style={{
                    color: "#dc2626",
                    margin: 0,
                    fontSize: "14px",
                  }}
                >
                  {showRegister ? registerError : loginError}
                </p>
              )}

              <button
                type="button"
                onClick={showRegister ? registerUser : loginUser}
                disabled={
                  showRegister ? registerLoading : loginLoading
                }
                style={{
                  width: "100%",
                  padding: "14px",
                  border: "none",
                  borderRadius: "10px",
                  cursor:
                    showRegister
                      ? registerLoading
                        ? "not-allowed"
                        : "pointer"
                      : loginLoading
                        ? "not-allowed"
                        : "pointer",
                  fontSize: "16px",
                  fontWeight: 600,
                }}
              >
                {showRegister
                  ? registerLoading
                    ? "Creating account..."
                    : "Create Account"
                  : loginLoading
                    ? "Logging in..."
                    : "Login"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRegister(!showRegister);
                  setLoginError("");
                  setRegisterError("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  padding: "8px",
                }}
              >
                {showRegister
                  ? "Already have an account? Login"
                  : "New to AgentPay? Create Account"}
              </button>
            </div>

            <p
              style={{
                textAlign: "center",
                marginTop: "20px",
                fontSize: "13px",
                opacity: 0.7,
              }}
            >
              AgentPay AI Commerce
            </p>
          </div>
        </main>
      </div>
    );
  }

  // =======================================================
  // PAYMENT SUCCESS SCREEN
  // =======================================================

  if (paymentSuccess) {
    return (
      <div className="app">
        <header className="header">
          <div className="brand">
            <div className="brand-icon">
              <Sparkles size={22} />
            </div>

            <div>
              <h1>AgentPay</h1>

              <span>
                AI Commerce Agent
              </span>
            </div>
          </div>

          <button
            className="orders-button"
            onClick={async () => {
              setPaymentSuccess(false);

              await fetchOrders();

              setShowOrders(true);
            }}
          >
            <Package size={18} />
            My Orders
          </button>
        </header>

        <main className="payment-success-page">
          <div className="success-card">
            <div className="success-icon">
              <CheckCircle size={70} />
            </div>

            <h1>
              Payment Successful!
            </h1>

            <p className="success-message">
              Your AgentPay order has been
              successfully confirmed.
            </p>

            <div className="success-amount">
              <span>
                Amount Paid
              </span>

              <strong>
                {formatPrice(
                  paidAmount
                )}
              </strong>
            </div>

            <div className="payment-details">
              <div className="payment-detail">
                <span>
                  Order ID
                </span>

                <strong>
                  {orderId}
                </strong>
              </div>

              <div className="payment-detail">
                <span>
                  Payment ID
                </span>

                <strong>
                  {paymentId}
                </strong>
              </div>

              <div className="payment-detail">
                <span>
                  Status
                </span>

                <strong className="success-status">
                  ✓ Paid
                </strong>
              </div>
            </div>

            <div className="success-actions">
              <button
                className="continue-button"
                onClick={
                  continueShopping
                }
              >
                <ArrowLeft size={18} />

                Continue Shopping
              </button>

              <button
                className="view-orders-button"
                onClick={async () => {
                  setPaymentSuccess(false);

                  await fetchOrders();

                  setShowOrders(true);
                }}
              >
                <Package size={18} />

                View Order
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // =======================================================
  // ORDER HISTORY
  // =======================================================

  if (showOrders) {
    return (
      <div className="app">
        <header className="header">
          <div className="brand">
            <div className="brand-icon">
              <Sparkles size={22} />
            </div>

            <div>
              <h1>AgentPay</h1>

              <span>
                AI Commerce Agent
              </span>
            </div>
          </div>

          <button
            className="back-button"
            onClick={() =>
              setShowOrders(false)
            }
          >
            <ArrowLeft size={18} />
            Back
          </button>
        </header>

        <main className="orders-page">
          <div className="orders-header">
            <div className="orders-badge">
              <Package size={16} />
              Order History
            </div>

            <h2>
              My Orders
            </h2>

            <p>
              Your recent AgentPay purchases
            </p>
          </div>

          {ordersLoading ? (
            <div className="empty-orders">
              <div className="empty-orders-icon">
                <Package size={45} />
              </div>

              <h3>
                Loading orders...
              </h3>

              <p>
                Fetching your purchases
                from AgentPay database.
              </p>
            </div>
          ) : orders.length === 0 ? (
            <div className="empty-orders">
              <div className="empty-orders-icon">
                <Package size={45} />
              </div>

              <h3>
                No orders yet
              </h3>

              <p>
                Your completed purchases
                will appear here.
              </p>

              <button
                className="start-shopping-button"
                onClick={() =>
                  setShowOrders(false)
                }
              >
                <ShoppingCart size={18} />

                Start Shopping
              </button>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map(
                (order) => (
                  <div
                    className="order-card"
                    key={order.id}
                  >
                    <div className="order-top">
                      <div>
                        <span className="order-label">
                          Order ID
                        </span>

                        <strong>
                          {
                            order.razorpayOrderId
                          }
                        </strong>
                      </div>

                      <span className="order-status">
                        ✓{" "}
                        {order.status ||
                          "Paid"}
                      </span>
                    </div>

                    <div className="order-date">
                      {new Date(
                        order.createdAt
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </div>

                    <div className="order-products">
                      {order.items.map(
                        (item) => (
                          <div
                            className="order-product"
                            key={item.id}
                          >
                            <div>
                              <h4>
                                {
                                  item.productName
                                }
                              </h4>

                              <span>
                                Quantity:{" "}
                                {
                                  item.quantity
                                }
                              </span>
                            </div>

                            <strong>
                              {formatPrice(
                                item.itemTotal
                              )}
                            </strong>
                          </div>
                        )
                      )}
                    </div>

                    <div className="order-payment">
                      <div>
                        <span>
                          Payment ID
                        </span>

                        <strong>
                          {
                            order.razorpayPaymentId
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Total
                        </span>

                        <strong>
                          {formatPrice(
                            order.amount
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  // =======================================================
  // MAIN UI
  // =======================================================

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-icon">
            <Sparkles size={22} />
          </div>

          <div>
            <h1>AgentPay</h1>

            <span>
              AI Commerce Agent
            </span>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="orders-button"
            onClick={async () => {
              await fetchOrders();

              setShowOrders(true);
            }}
          >
            <Package size={18} />
            My Orders
          </button>

          <button
            className="orders-button"
            onClick={logoutUser}
          >
            Logout
          </button>

          <div className="cart-badge">
            <ShoppingCart size={20} />

            <span>
              {cart.reduce(
                (total, item) =>
                  total + item.quantity,
                0
              )}
            </span>
          </div>
        </div>
      </header>

      <main className="container">
        {/* =================================================
            HERO
        ================================================= */}

        <section className="hero">
          <div className="hero-badge">
            <Sparkles size={16} />

            AI-Powered Shopping
          </div>

          <h2>
            Shop smarter with your
            <span>
              {" "}AI Agent
            </span>
          </h2>

          <p>
            Tell AgentPay what you need.
            Our AI finds, recommends and
            helps you buy the right products.
          </p>

          <div className="search-box">
            <input
              value={message}
              onChange={(e) =>
                setMessage(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter"
                ) {
                  askAgent();
                }
              }}
              placeholder="Try: I need a smartphone under ₹30,000"
            />

            <button
              onClick={askAgent}
              disabled={loading}
            >
              <Send size={18} />

              {loading
                ? "Thinking..."
                : "Ask Agent"}
            </button>
          </div>
        </section>

        {/* =================================================
            AI RESPONSE
        ================================================= */}

        {reply && (
          <section className="ai-response">
            <div className="section-title">
              <Sparkles size={20} />

              <h3>
                Agent Recommendation
              </h3>
            </div>

            <p>
              {reply}
            </p>
          </section>
        )}

        {/* =================================================
            PRODUCTS
        ================================================= */}

        {products.length > 0 && (
          <section className="section">
            <div className="section-title product-results-heading">
              <div className="product-results-title">
                <ShoppingCart size={20} />

                <div>
                  <h3>Recommended Products</h3>
                  <span className="product-results-count">
                    {products.length} {products.length === 1 ? "product" : "products"} found
                  </span>
                </div>
              </div>

              {selectedProduct && (
                <span className="ai-pick-badge">
                  <Sparkles size={13} />
                  AI Pick
                </span>
              )}
            </div>

            <div className="product-grid">
              {products.map(
                (product) => (
                  <div
                    className={`product-card ${
                      selectedProduct?.id ===
                      product.id
                        ? "selected"
                        : ""
                    }`}
                    key={product.id}
                  >
                    {selectedProduct?.id === product.id && (
                      <div className="product-pick-label">
                        <Sparkles size={13} />
                        Recommended for you
                      </div>
                    )}

                    <div className="product-image-wrap">
                      <img
                        className="product-image"
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                      />
                    </div>

                    <div className="product-category">
                      {product.category}
                    </div>

                    <h4>
                      {product.name}
                    </h4>

                    <p>
                      {
                        product.description
                      }
                    </p>

                    <div className="tags">
                      {product.tags
                        .slice(0, 3)
                        .map(
                          (tag) => (
                            <span
                              key={tag}
                            >
                              #{tag}
                            </span>
                          )
                        )}
                    </div>

                    <div className="product-bottom">
                      <div className="product-price-block">
                        <span className="price-label">Price</span>
                        <strong>
                          {formatPrice(
                            product.price
                          )}
                        </strong>
                      </div>

                      <button
                        onClick={() =>
                          addToCart(
                            product.id
                          )
                        }
                      >
                        <Plus size={17} />

                        Add
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {/* =================================================
            UPSELL
        ================================================= */}

        {upsells.length > 0 && (
          <section className="upsell">
            <div className="upsell-title">
              <Sparkles size={21} />

              <div>
                <h3>
                  You may also like
                </h3>

                <p>
                  AI-powered complementary
                  recommendation
                </p>
              </div>
            </div>

            <div className="upsell-grid">
              {upsells.map(
                (product) => (
                  <div
                    className="upsell-card"
                    key={product.id}
                  >
                    <div className="upsell-image-wrap">
                      <img
                        className="upsell-image"
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                      />
                    </div>

                    <div>
                      <h4>
                        {product.name}
                      </h4>

                      <p>
                        {
                          product.description
                        }
                      </p>

                      <strong>
                        {formatPrice(
                          product.price
                        )}
                      </strong>
                    </div>

                    <button
                      onClick={() =>
                        addToCart(
                          product.id
                        )
                      }
                    >
                      <Plus size={17} />

                      Add
                    </button>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {/* =================================================
            CART
        ================================================= */}

        <section className="cart-section">
          <div className="section-title">
            <ShoppingCart size={21} />

            <h3>
              Your Cart
            </h3>
          </div>

          {cart.length === 0 ? (
            <div className="empty-cart">
              <ShoppingCart size={38} />

              <p>
                Your cart is empty
              </p>

              <span>
                Ask AgentPay to find
                something for you.
              </span>
            </div>
          ) : (
            <>
              <div className="cart-items">
                {cart.map(
                  (item) => (
                    <div
                      className="cart-item"
                      key={
                        item.product.id
                      }
                    >
                      <div>
                        <h4>
                          {
                            item.product
                              .name
                          }
                        </h4>

                        <span>
                          {formatPrice(
                            item.product
                              .price
                          )}
                        </span>
                      </div>

                      {/* QUANTITY CONTROLS */}

                      <div className="cart-controls">
                        <div className="quantity-control">
                          <button
                            type="button"
                            className="quantity-button"
                            aria-label="Decrease quantity"
                            onClick={() =>
                              updateCartQuantity(
                                item.product.id,
                                item.quantity - 1
                              )
                            }
                          >
                            −
                          </button>

                          <span className="quantity-value">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            className="quantity-button"
                            aria-label="Increase quantity"
                            onClick={() =>
                              updateCartQuantity(
                                item.product.id,
                                item.quantity + 1
                              )
                            }
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          className="remove-cart-button"
                          aria-label="Remove product"
                          onClick={() =>
                            removeFromCart(
                              item.product.id
                            )
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* CART TOTAL */}

              <div className="cart-total">
                <div>
                  <span>
                    Subtotal
                  </span>

                  <strong>
                    {formatPrice(
                      subtotal
                    )}
                  </strong>
                </div>

                <div className="cart-actions">
                  <button
                    type="button"
                    className="clear-cart-button"
                    onClick={clearCart}
                    disabled={
                      paymentLoading
                    }
                  >
                    Clear Cart
                  </button>

                  <button
                    className="checkout-button"
                    onClick={() => setShowCheckout(true)}
                    disabled={
                      paymentLoading
                    }
                  >
                    <CreditCard
                      size={19}
                    />

                    {paymentLoading
                      ? "Opening Checkout..."
                      : "Proceed to Payment"}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {showCheckout && (
          <div
            className="checkout-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
          >
            <div className="checkout-modal">
              <div className="checkout-modal-header">
                <div>
                  <span className="checkout-badge">
                    <CreditCard size={15} />
                    Secure Checkout
                  </span>
                  <h2 id="checkout-title">Review your order</h2>
                  <p>Check the items and total before opening Razorpay.</p>
                </div>

                <button
                  type="button"
                  className="checkout-close"
                  onClick={() => setShowCheckout(false)}
                  aria-label="Close checkout"
                  disabled={paymentLoading}
                >
                  ×
                </button>
              </div>

              <div className="checkout-items">
                {cart.map((item) => (
                  <div className="checkout-item" key={item.product.id}>
                    <div className="checkout-item-image">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                      />
                    </div>

                    <div className="checkout-item-info">
                      <strong>{item.product.name}</strong>
                      <span>
                        {item.quantity} × {formatPrice(item.product.price)}
                      </span>
                    </div>

                    <strong>
                      {formatPrice(item.itemTotal)}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="checkout-summary">
                <div>
                  <span>Items</span>
                  <strong>
                    {cart.reduce(
                      (total, item) => total + item.quantity,
                      0
                    )}
                  </strong>
                </div>

                <div>
                  <span>Subtotal</span>
                  <strong>{formatPrice(subtotal)}</strong>
                </div>

                <div className="checkout-total">
                  <span>Total payable</span>
                  <strong>{formatPrice(subtotal)}</strong>
                </div>
              </div>

              <div className="checkout-trust">
                <span>🔒 Secure Razorpay checkout</span>
                <span>✓ Payment verification enabled</span>
              </div>

              <div className="checkout-actions">
                <button
                  type="button"
                  className="clear-cart-button"
                  onClick={() => setShowCheckout(false)}
                  disabled={paymentLoading}
                >
                  Back to Cart
                </button>

                <button
                  type="button"
                  className="checkout-button"
                  onClick={startPayment}
                  disabled={paymentLoading}
                >
                  <CreditCard size={19} />
                  {paymentLoading
                    ? "Opening Checkout..."
                    : `Pay ${formatPrice(subtotal)}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
