export type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  tags: string[];
  image: string;
};

export const products: Product[] = [
  {
    id: 1,
    name: "Samsung Galaxy A56",
    category: "smartphone",
    price: 29999,
    description: "5G smartphone with AMOLED display and 8GB RAM",
    tags: ["phone", "android", "5g", "camera"],
    image:
      "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: 2,
    name: "OnePlus Nord 5",
    category: "smartphone",
    price: 27999,
    description: "Fast performance smartphone with 12GB RAM",
    tags: ["phone", "android", "gaming", "5g"],
    image:
      "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: 3,
    name: "Nothing Phone 3a",
    category: "smartphone",
    price: 24999,
    description: "Stylish smartphone with clean Android experience",
    tags: ["phone", "android", "camera", "design"],
    image:
      "https://images.unsplash.com/photo-1556656793-08538906a9f8?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: 4,
    name: "Lenovo IdeaPad Slim 5",
    category: "laptop",
    price: 59999,
    description: "Powerful laptop suitable for coding and development",
    tags: ["laptop", "coding", "java", "programming"],
    image:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: 5,
    name: "ASUS Vivobook 15",
    category: "laptop",
    price: 54999,
    description: "15-inch laptop with strong performance for students",
    tags: ["laptop", "student", "coding"],
    image:
      "https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: 6,
    name: "Sony WH-CH720N",
    category: "headphones",
    price: 8999,
    description: "Wireless noise-cancelling headphones",
    tags: ["headphones", "music", "noise cancellation"],
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: 7,
    name: "Logitech MX Master 3S",
    category: "accessory",
    price: 7999,
    description: "Premium wireless mouse for productivity",
    tags: ["mouse", "productivity", "coding"],
    image:
      "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=700&q=85",
  },
];
