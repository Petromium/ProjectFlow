import "dotenv/config";
import { db } from "../db";
import { users } from "@shared/schema";
import { storage } from "../storage";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import crypto from "crypto";

const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function generateUserId(): string {
  return `user-${crypto.randomBytes(16).toString("hex")}`;
}

async function setupAdmin() {
  const email = "mohammad.al.jarad@petromium.com";
  const password = "Bali.2026";
  const firstName = "Mohammad";
  const lastName = "Al Jarad";

  console.log(`Setting up admin user: ${email}...`);

  try {
    // 1. Check if user exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    
    const passwordHash = await hashPassword(password);
    let userId;

    if (existingUser) {
      console.log("User exists. Updating password and admin status...");
      userId = existingUser.id;
      await db.update(users)
        .set({ 
          passwordHash,
          isSystemAdmin: true,
          emailVerified: true,
          firstName,
          lastName
        })
        .where(eq(users.id, userId));
    } else {
      console.log("User does not exist. Creating new admin user...");
      userId = generateUserId();
      await db.insert(users).values({
        id: userId,
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        emailVerified: true,
        isSystemAdmin: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Assign demo organization
      await storage.assignDemoOrgToUser(userId);
    }

    console.log("User setup complete.");

    // 2. Initialize Subscription Plans
    console.log("Initializing subscription plans...");
    const existingPlans = await storage.getSubscriptionPlans();
    
    if (existingPlans.length === 0) {
      const defaultPlans = [
        {
          tier: 'free',
          name: 'Free',
          priceMonthly: 0,
          priceYearly: 0,
          projectLimit: 3,
          userLimit: 2,
          aiTokenLimit: 10000,
          storageQuotaBytes: 536870912, // 512MB
          features: {
            description: 'Get started with basic project management features',
            emailsMonthly: 50,
            includesCloudSync: false,
            includesAdvancedReports: false,
            includesWhiteLabel: false,
            maxTasksPerProject: 100
          }
        },
        {
          tier: 'starter',
          name: 'Starter',
          priceMonthly: 2900, // $29.00
          priceYearly: 29000, // $290.00
          projectLimit: 10,
          userLimit: 5,
          aiTokenLimit: 50000,
          storageQuotaBytes: 2147483648, // 2GB
          features: {
            description: 'Essential features for small teams',
            emailsMonthly: 500,
            includesCloudSync: true,
            includesAdvancedReports: false,
            includesWhiteLabel: false,
            maxTasksPerProject: 500
          }
        },
        {
          tier: 'professional',
          name: 'Professional',
          priceMonthly: 7900, // $79.00
          priceYearly: 79000, // $790.00
          projectLimit: 50,
          userLimit: 20,
          aiTokenLimit: 200000,
          storageQuotaBytes: 10737418240, // 10GB
          features: {
            description: 'Advanced features for growing organizations',
            emailsMonthly: 2000,
            includesCloudSync: true,
            includesAdvancedReports: true,
            includesWhiteLabel: false,
            maxTasksPerProject: 1000
          }
        },
        {
          tier: 'enterprise',
          name: 'Enterprise',
          priceMonthly: 19900, // $199.00
          priceYearly: 199000, // $1990.00
          projectLimit: 100,
          userLimit: 100,
          aiTokenLimit: 1000000,
          storageQuotaBytes: 53687091200, // 50GB
          features: {
            description: 'Full-featured solution for large enterprises',
            emailsMonthly: 10000,
            includesCloudSync: true,
            includesAdvancedReports: true,
            includesWhiteLabel: true,
            maxTasksPerProject: 10000
          }
        }
      ];

      for (const plan of defaultPlans) {
        await storage.createSubscriptionPlan(plan);
        console.log(`Created plan: ${plan.name}`);
      }
    } else {
      console.log("Subscription plans already exist. Skipping initialization.");
    }

    console.log("Admin setup completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Admin setup failed:", error);
    process.exit(1);
  }
}

setupAdmin();

