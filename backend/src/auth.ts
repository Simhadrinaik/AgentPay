import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";

// =========================================================
// TYPES
// =========================================================

type RegisterInput = {
  name?: string;
  email?: string;
  password?: string;
};

type LoginInput = {
  email?: string;
  password?: string;
};

// =========================================================
// JWT CONFIG
// =========================================================

const JWT_SECRET: string | undefined =
  process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is missing. Check backend/.env"
  );
}

// =========================================================
// HELPERS
// =========================================================

const normalizeEmail = (email: string) => {
  return email.trim().toLowerCase();
};

// =========================================================
// REGISTER
// =========================================================

export async function registerUser(
  input: RegisterInput
) {
  const name = input.name?.trim();

  const email = input.email
    ? normalizeEmail(input.email)
    : "";

  const password = input.password || "";

  // -------------------------------------------------------
  // Validation
  // -------------------------------------------------------

  if (!name) {
    return {
      success: false,
      message: "Name is required",
    };
  }

  if (name.length < 2) {
    return {
      success: false,
      message: "Name must be at least 2 characters",
    };
  }

  if (!email) {
    return {
      success: false,
      message: "Email is required",
    };
  }

  if (!email.includes("@")) {
    return {
      success: false,
      message: "Please enter a valid email",
    };
  }

  if (password.length < 6) {
    return {
      success: false,
      message:
        "Password must be at least 6 characters",
    };
  }

  // -------------------------------------------------------
  // Check existing user
  // -------------------------------------------------------

  const existingUser =
    await prisma.user.findUnique({
      where: {
        email,
      },
    });

  if (existingUser) {
    return {
      success: false,
      message:
        "An account with this email already exists",
    };
  }

  // -------------------------------------------------------
  // Hash password
  // -------------------------------------------------------

  const passwordHash =
    await bcrypt.hash(password, 12);

  // -------------------------------------------------------
  // Create user
  // -------------------------------------------------------

  const user =
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });

  // -------------------------------------------------------
  // Create JWT
  // -------------------------------------------------------

  const token = createAuthToken(user.id);

  // -------------------------------------------------------
  // Response
  // -------------------------------------------------------

  return {
    success: true,
    message: "Account created successfully",

    token,

    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
  };
}

// =========================================================
// LOGIN
// =========================================================

export async function loginUser(
  input: LoginInput
) {
  const email = input.email
    ? normalizeEmail(input.email)
    : "";

  const password = input.password || "";

  // -------------------------------------------------------
  // Validation
  // -------------------------------------------------------

  if (!email || !password) {
    return {
      success: false,
      message:
        "Email and password are required",
    };
  }

  // -------------------------------------------------------
  // Find user
  // -------------------------------------------------------

  const user =
    await prisma.user.findUnique({
      where: {
        email,
      },
    });

  if (!user) {
    return {
      success: false,
      message:
        "Invalid email or password",
    };
  }

  // -------------------------------------------------------
  // Verify password
  // -------------------------------------------------------

  const passwordValid =
    await bcrypt.compare(
      password,
      user.passwordHash
    );

  if (!passwordValid) {
    return {
      success: false,
      message:
        "Invalid email or password",
    };
  }

  // -------------------------------------------------------
  // Create JWT
  // -------------------------------------------------------

  const token =
    createAuthToken(user.id);

  // -------------------------------------------------------
  // Login success
  // -------------------------------------------------------

  return {
    success: true,
    message: "Login successful",

    token,

    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
  };
}

// =========================================================
// GET USER BY ID
// =========================================================

export async function getUserById(
  userId: string
) {
  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

  if (!user) {
    return {
      success: false,
      message: "User not found",
    };
  }

  return {
    success: true,

    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
  };
}

// =========================================================
// CREATE AUTH TOKEN
// =========================================================

export function createAuthToken(
  userId: string
) {
  // TypeScript knows JWT_SECRET is available
  // after the runtime check above.
  return jwt.sign(
    {
      userId,
    },
    JWT_SECRET as string,
    {
      expiresIn: "7d",
    }
  );
}

// =========================================================
// VERIFY AUTH TOKEN
// =========================================================

export function verifyAuthToken(
  token: string
): { userId: string } | null {
  try {
    const decoded = jwt.verify(
      token,
      JWT_SECRET as string
    ) as {
      userId?: string;
    };

    if (!decoded.userId) {
      return null;
    }

    return {
      userId: decoded.userId,
    };
  } catch {
    return null;
  }
}
