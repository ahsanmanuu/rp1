const CASHFREE_ENV = process.env.CASHFREE_ENV || "test";
const CLIENT_ID = process.env.CASHFREE_APP_ID || "";
const CLIENT_SECRET = process.env.CASHFREE_SECRET_KEY || "";

const BASE_URL = CASHFREE_ENV === "production"
  ? "https://api.cashfree.com/pg"
  : "https://sandbox.cashfree.com/pg";

export interface CashfreeOrderParams {
  orderId: string;
  amount: number;
  customerEmail: string;
  customerId: string;
  customerPhone?: string;
  returnUrl: string;
}

export async function createCashfreeOrder(params: CashfreeOrderParams) {
  const url = `${BASE_URL}/orders`;
  const body = {
    order_id: params.orderId,
    order_amount: params.amount,
    order_currency: "INR",
    customer_details: {
      customer_id: params.customerId,
      customer_email: params.customerEmail,
      customer_phone: params.customerPhone || "9999999999"
    },
    order_meta: {
      return_url: params.returnUrl
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": "2025-01-01",
      "x-client-id": CLIENT_ID,
      "x-client-secret": CLIENT_SECRET
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("[CASHFREE] Order creation failed:", JSON.stringify(data));
    throw new Error(data.message || "Failed to create Cashfree order");
  }

  console.log("[CASHFREE] Order created:", data.order_id, "| session:", data.payment_session_id?.slice(0, 30) + "...");

  return {
    orderId: data.order_id,
    paymentSessionId: data.payment_session_id,
  };
}

export async function getCashfreeOrder(orderId: string) {
  const url = `${BASE_URL}/orders/${orderId}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-api-version": "2025-01-01",
      "x-client-id": CLIENT_ID,
      "x-client-secret": CLIENT_SECRET
    },
    signal: AbortSignal.timeout(15000),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch Cashfree order status");
  }

  return {
    orderId: data.order_id,
    orderStatus: data.order_status, // "PAID", "ACTIVE", "EXPIRED", etc.
    orderAmount: data.order_amount,
    customerDetails: data.customer_details
  };
}
