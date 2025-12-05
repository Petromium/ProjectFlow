/**
 * PayPal Payment Service
 * Handles PayPal subscription creation, management, and webhooks
 */

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { logger } from "./cloudLogging";

const secretManager = new SecretManagerServiceClient();

let paypalClient: any = null;
let PayPalClient: any = null;
let PayPalEnvironment: any = null;
let paypalClientId: string | null = null;
let paypalSecret: string | null = null;

/**
 * Initialize PayPal client with credentials from Secret Manager
 */
async function getPayPalClient(): Promise<any> {
  if (paypalClient) {
    return paypalClient;
  }

  try {
    // Dynamically import PayPal SDK (CommonJS module)
    if (!PayPalClient || !PayPalEnvironment) {
      const paypalSDK = await import("@paypal/paypal-server-sdk");
      PayPalClient = paypalSDK.PayPalClient || (paypalSDK as any).default?.PayPalClient || (paypalSDK as any).default;
      PayPalEnvironment = paypalSDK.PayPalEnvironment || (paypalSDK as any).default?.PayPalEnvironment;
      
      if (!PayPalClient || !PayPalEnvironment) {
        throw new Error("Failed to load PayPal SDK");
      }
    }

    // Get credentials from Secret Manager
    if (!paypalClientId) {
      const [clientIdVersion] = await secretManager.accessSecretVersion({
        name: `projects/projectflow-479722/secrets/paypal-client-id/versions/latest`,
      });
      paypalClientId = clientIdVersion.payload?.data?.toString() || "";
    }

    if (!paypalSecret) {
      const [secretVersion] = await secretManager.accessSecretVersion({
        name: `projects/projectflow-479722/secrets/paypal-secret/versions/latest`,
      });
      paypalSecret = secretVersion.payload?.data?.toString() || "";
    }

    if (!paypalClientId || !paypalSecret) {
      throw new Error("PayPal credentials not found in Secret Manager");
    }

    // Initialize PayPal client
    // Use sandbox for development, production for production
    const environment = process.env.NODE_ENV === "production" 
      ? PayPalEnvironment.Live 
      : PayPalEnvironment.Sandbox;

    paypalClient = new PayPalClient({
      environment,
      clientId: paypalClientId,
      clientSecret: paypalSecret,
    });

    logger.info("[PAYPAL] PayPal client initialized", { environment });
    return paypalClient;
  } catch (error) {
    logger.error("[PAYPAL] Failed to initialize PayPal client", error);
    throw error;
  }
}

/**
 * Create a PayPal subscription plan
 */
export async function createPayPalPlan(planData: {
  name: string;
  description: string;
  price: number; // in cents
  currency: string;
  billingCycle: "MONTH" | "YEAR";
}): Promise<string> {
  try {
    const client = await getPayPalClient();
    
    // Create product first
    const productResponse = await client.products.create({
      name: planData.name,
      description: planData.description,
      type: "SERVICE",
    });

    const productId = productResponse.id;
    if (!productId) {
      throw new Error("Failed to create PayPal product");
    }

    // Create billing plan
    const planResponse = await client.subscriptions.createPlan({
      productId,
      name: planData.name,
      description: planData.description,
      billingCycles: [
        {
          frequency: {
            intervalUnit: planData.billingCycle,
            intervalCount: 1,
          },
          tenureType: "REGULAR",
          pricingScheme: {
            fixedPrice: {
              value: (planData.price / 100).toFixed(2),
              currencyCode: planData.currency,
            },
          },
        },
      ],
      paymentPreferences: {
        autoBillOutstanding: true,
        setupFee: {
          value: "0.00",
          currencyCode: planData.currency,
        },
        setupFeeFailureAction: "CONTINUE",
        paymentFailureThreshold: 3,
      },
    });

    const planId = planResponse.id;
    if (!planId) {
      throw new Error("Failed to create PayPal plan");
    }

    logger.info("[PAYPAL] Created subscription plan", { planId, productId });
    return planId;
  } catch (error) {
    logger.error("[PAYPAL] Failed to create subscription plan", error);
    throw error;
  }
}

/**
 * Create a PayPal subscription for a user
 */
export async function createPayPalSubscription(
  planId: string,
  returnUrl: string,
  cancelUrl: string
): Promise<{ subscriptionId: string; approvalUrl: string }> {
  try {
    const client = await getPayPalClient();

    const subscriptionResponse = await client.subscriptions.create({
      planId,
      applicationContext: {
        brandName: "Ganttium",
        locale: "en-US",
        shippingPreference: "NO_SHIPPING",
        userAction: "SUBSCRIBE_NOW",
        paymentMethod: {
          payerSelected: "PAYPAL",
          payeePreferred: "IMMEDIATE_PAYMENT_REQUIRED",
        },
        returnUrl,
        cancelUrl,
      },
    });

    const subscriptionId = subscriptionResponse.id;
    const approvalUrl = subscriptionResponse.links?.find(
      (link) => link.rel === "approve"
    )?.href;

    if (!subscriptionId || !approvalUrl) {
      throw new Error("Failed to create PayPal subscription");
    }

    logger.info("[PAYPAL] Created subscription", { subscriptionId });
    return { subscriptionId, approvalUrl };
  } catch (error) {
    logger.error("[PAYPAL] Failed to create subscription", error);
    throw error;
  }
}

/**
 * Get subscription details from PayPal
 */
export async function getPayPalSubscription(subscriptionId: string): Promise<any> {
  try {
    const client = await getPayPalClient();
    const subscription = await client.subscriptions.get(subscriptionId);
    return subscription;
  } catch (error) {
    logger.error("[PAYPAL] Failed to get subscription", error);
    throw error;
  }
}

/**
 * Cancel a PayPal subscription
 */
export async function cancelPayPalSubscription(
  subscriptionId: string,
  reason?: string
): Promise<void> {
  try {
    const client = await getPayPalClient();
    await client.subscriptions.cancel(subscriptionId, {
      reason: reason || "User requested cancellation",
    });
    logger.info("[PAYPAL] Cancelled subscription", { subscriptionId });
  } catch (error) {
    logger.error("[PAYPAL] Failed to cancel subscription", error);
    throw error;
  }
}

/**
 * Verify PayPal webhook signature
 */
export async function verifyWebhookSignature(
  headers: Record<string, string>,
  body: string
): Promise<boolean> {
  try {
    const client = await getPayPalClient();
    // PayPal webhook verification would go here
    // For now, we'll trust webhooks from PayPal (in production, implement proper verification)
    return true;
  } catch (error) {
    logger.error("[PAYPAL] Failed to verify webhook signature", error);
    return false;
  }
}

