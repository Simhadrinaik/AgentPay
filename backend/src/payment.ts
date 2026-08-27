import dotenv from "dotenv";
import Razorpay from "razorpay";

dotenv.config();

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  throw new Error(
    "Razorpay credentials are missing. Check backend/.env"
  );
}

export const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});