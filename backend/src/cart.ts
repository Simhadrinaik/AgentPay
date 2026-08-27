import { products } from "./products";
import { prisma } from "./prisma";

// =========================================================
// TYPES
// =========================================================

type CartResponseItem = {
  product: (typeof products)[number];
  quantity: number;
  itemTotal: number;
};

// =========================================================
// HELPERS
// =========================================================

const findProduct = (productId: number) => {
  return products.find((p) => p.id === productId);
};

// =========================================================
// ADD TO CART
// =========================================================

export async function addToCart(
  userId: string,
  productId: number,
  quantity = 1
) {
  const product = findProduct(productId);

  if (!product) {
    return {
      success: false,
      message: "Product not found",
    };
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return {
      success: false,
      message: "Quantity must be at least 1",
    };
  }

  const existingItem = await prisma.cartItem.findUnique({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
  });

  if (existingItem) {
    await prisma.cartItem.update({
      where: {
        id: existingItem.id,
      },
      data: {
        quantity: existingItem.quantity + quantity,
      },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        userId,
        productId,
        quantity,
      },
    });
  }

  return getCart(userId);
}

// =========================================================
// UPDATE CART QUANTITY
// =========================================================

export async function updateCartQuantity(
  userId: string,
  productId: number,
  quantity: number
) {
  const product = findProduct(productId);

  if (!product) {
    return {
      success: false,
      message: "Product not found",
    };
  }

  if (!Number.isInteger(quantity)) {
    return {
      success: false,
      message: "Quantity must be a whole number",
    };
  }

  if (quantity <= 0) {
    return removeFromCart(userId, productId);
  }

  const existingItem = await prisma.cartItem.findUnique({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
  });

  if (!existingItem) {
    return {
      success: false,
      message: "Product is not in cart",
    };
  }

  await prisma.cartItem.update({
    where: {
      id: existingItem.id,
    },
    data: {
      quantity,
    },
  });

  return getCart(userId);
}

// =========================================================
// REMOVE FROM CART
// =========================================================

export async function removeFromCart(
  userId: string,
  productId: number
) {
  await prisma.cartItem.deleteMany({
    where: {
      userId,
      productId,
    },
  });

  return getCart(userId);
}

// =========================================================
// CLEAR CART
// =========================================================

export async function clearCart(userId: string) {
  await prisma.cartItem.deleteMany({
    where: {
      userId,
    },
  });

  return getCart(userId);
}

// =========================================================
// GET CART
// =========================================================

export async function getCart(userId: string) {
  const cartItems = await prisma.cartItem.findMany({
    where: {
      userId,
    },
    orderBy: {
      id: "asc",
    },
  });

  const items: CartResponseItem[] = cartItems
    .map((item) => {
      const product = findProduct(item.productId);

      if (!product) {
        return null;
      }

      return {
        product,
        quantity: item.quantity,
        itemTotal: product.price * item.quantity,
      };
    })
    .filter(
      (item): item is CartResponseItem => item !== null
    );

  const subtotal = items.reduce(
    (total, item) => total + item.itemTotal,
    0
  );

  const itemCount = items.reduce(
    (total, item) => total + item.quantity,
    0
  );

  return {
    success: true,
    items,
    itemCount,
    subtotal,
  };
}
