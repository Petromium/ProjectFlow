/**
 * Authentication Service
 * Replaces Replit Auth with Email/Password + Google OAuth + Optional 2FA
 */

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import bcrypt from "bcrypt";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";
import type { Express, RequestHandler, Request, Response, NextFunction } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { db, pool } from "./db";
import { users, sessions } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { authLimiter, passwordResetLimiter } from "./middleware/security";
import { logger } from "./services/cloudLogging";

// Session configuration
const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
const SESSION_COOKIE_NAME = "sessionId"; // Consistent cookie name

/**
 * PERMANENT FIX: Ensure sessions table exists in database
 * This function creates the sessions table if it doesn't exist, using the exact schema
 * required by connect-pg-simple. This ensures sessions persist across server restarts.
 */
async function ensureSessionsTableExists(): Promise<void> {
    try {
        // Use raw SQL execution through Drizzle
        await db.execute(sql`SELECT 1 FROM sessions LIMIT 1`);
        logger.info("[AUTH] Sessions table exists and is accessible");
    } catch (error: any) {
        // Table doesn't exist or error accessing it - create it
        if (error.code === "42P01" || error.message?.includes("does not exist") || (error.message?.includes("relation") && error.message?.includes("does not exist"))) {
            logger.warn("[AUTH] Sessions table not found, creating it...");
            try {
                // Create sessions table with exact schema required by connect-pg-simple
                await db.execute(sql.raw(`
                    CREATE TABLE IF NOT EXISTS sessions (
                        sid VARCHAR NOT NULL PRIMARY KEY,
                        sess JSON NOT NULL,
                        expire TIMESTAMP NOT NULL
                    )
                `));
                
                // Create index on expire for performance
                await db.execute(sql.raw(`
                    CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire)
                `));
                
                logger.info("[AUTH] Sessions table created successfully");
            } catch (createError: any) {
                logger.error("[AUTH] Failed to create sessions table", createError);
                // Don't throw - let connect-pg-simple handle it with createTableIfMissing
                // But log the error for debugging
            }
        } else {
            logger.error("[AUTH] Error checking sessions table", error);
            // Re-throw if it's a different error (connection issue, etc.)
            throw error;
        }
    }
}

const pgStore = connectPg(session);
export const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true, // Fallback: let connect-pg-simple create if our function fails
    ttl: sessionTtl,
    tableName: "sessions",
});

// Password hashing config
const SALT_ROUNDS = 12;

// Generate secure random token
function generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
}

// Generate user ID
function generateUserId(): string {
    return `user-${crypto.randomBytes(16).toString("hex")}`;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// Generate backup codes for 2FA
function generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
        codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
    }
    return codes;
}

export function getSession() {
    const isProduction = process.env.NODE_ENV === "production";

    return session({
        secret: process.env.SESSION_SECRET!,
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        name: SESSION_COOKIE_NAME, // Don't use default "connect.sid" for security
        cookie: {
            httpOnly: true,
            secure: isProduction, // Requires HTTPS in production
            sameSite: isProduction ? "strict" : "lax", // CSRF protection
            maxAge: sessionTtl,
        },
    });
}

// Extend Express User type
declare global {
    namespace Express {
        interface User {
            id: string;
            email: string;
            firstName?: string | null;
            lastName?: string | null;
            profileImageUrl?: string | null;
            emailVerified?: boolean;
            totpEnabled?: boolean;
            pendingTotpVerification?: boolean;
        }
    }
}

export async function setupAuth(app: Express) {
    // PERMANENT FIX: Ensure sessions table exists BEFORE setting up session middleware
    try {
        await ensureSessionsTableExists();
        logger.info("[AUTH] Session infrastructure verified and ready");
    } catch (error) {
        logger.error("[AUTH] CRITICAL: Failed to initialize sessions table", error);
        // Continue anyway - connect-pg-simple will try to create it
        // But log the error so we know there's a problem
    }

    app.set("trust proxy", 1);
    app.use(getSession());
    app.use(passport.initialize());
    app.use(passport.session());

    // Serialize user to session
    passport.serializeUser((user: Express.User, done) => {
        done(null, {
            id: user.id,
            pendingTotpVerification: user.pendingTotpVerification
        });
    });

    // Deserialize user from session
    passport.deserializeUser(async (sessionData: { id: string; pendingTotpVerification?: boolean }, done) => {
        try {
            const user = await storage.getUser(sessionData.id);
            if (user) {
                done(null, {
                    ...user,
                    pendingTotpVerification: sessionData.pendingTotpVerification
                });
            } else {
                done(null, false);
            }
        } catch (error) {
            done(error, false);
        }
    });

    // Local Strategy (Email/Password)
    passport.use(
        new LocalStrategy(
            { usernameField: "email", passwordField: "password" },
            async (email, password, done) => {
                try {
                    const [user] = await db
                        .select()
                        .from(users)
                        .where(eq(users.email, email.toLowerCase()));

                    if (!user) {
                        return done(null, false, { message: "Invalid email or password" });
                    }

                    if (!user.passwordHash) {
                        return done(null, false, {
                            message: "Please sign in with Google or reset your password"
                        });
                    }

                    const isValid = await verifyPassword(password, user.passwordHash);
                    if (!isValid) {
                        return done(null, false, { message: "Invalid email or password" });
                    }

                    // Check if 2FA is enabled
                    const pendingTotpVerification = user.totpEnabled;

                    return done(null, {
                        id: user.id,
                        email: user.email!,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        profileImageUrl: user.profileImageUrl,
                        emailVerified: user.emailVerified,
                        totpEnabled: user.totpEnabled,
                        pendingTotpVerification
                    });
                } catch (error) {
                    return done(error);
                }
            }
        )
    );

    // Google OAuth Strategy (only if configured)
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        passport.use(
            new GoogleStrategy(
                {
                    clientID: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
                    scope: ["profile", "email"],
                },
                async (accessToken, refreshToken, profile, done) => {
                    try {
                        const email = profile.emails?.[0]?.value?.toLowerCase();
                        if (!email) {
                            return done(null, false, { message: "No email found in Google profile" });
                        }

                        // Check if user exists by Google ID
                        let [user] = await db
                            .select()
                            .from(users)
                            .where(eq(users.googleId, profile.id));

                        // If not found by Google ID, try by email (link accounts)
                        if (!user) {
                            [user] = await db
                                .select()
                                .from(users)
                                .where(eq(users.email, email));
                        }

                        if (user) {
                            // Update existing user with Google info
                            await db.update(users).set({
                                googleId: profile.id,
                                emailVerified: true,
                                firstName: user.firstName || profile.name?.givenName,
                                lastName: user.lastName || profile.name?.familyName,
                                profileImageUrl: user.profileImageUrl || profile.photos?.[0]?.value,
                                lastLoginAt: new Date(),
                            }).where(eq(users.id, user.id));

                            await storage.assignDemoOrgToUser(user.id);

                            const pendingTotpVerification = user.totpEnabled;

                            return done(null, {
                                id: user.id,
                                email: user.email!,
                                firstName: profile.name?.givenName,
                                lastName: profile.name?.familyName,
                                profileImageUrl: profile.photos?.[0]?.value,
                                emailVerified: true,
                                totpEnabled: user.totpEnabled,
                                pendingTotpVerification
                            });
                        }

                        // Create new user
                        const userId = generateUserId();
                        await db.insert(users).values({
                            id: userId,
                            email: email,
                            googleId: profile.id,
                            firstName: profile.name?.givenName,
                            lastName: profile.name?.familyName,
                            profileImageUrl: profile.photos?.[0]?.value,
                            emailVerified: true,
                            lastLoginAt: new Date(),
                        });

                        await storage.assignDemoOrgToUser(userId);

                        return done(null, {
                            id: userId,
                            email,
                            firstName: profile.name?.givenName,
                            lastName: profile.name?.familyName,
                            profileImageUrl: profile.photos?.[0]?.value,
                            emailVerified: true,
                            totpEnabled: false,
                            pendingTotpVerification: false
                        });
                    } catch (error) {
                        return done(error as Error);
                    }
                }
            )
        );
    }

    // ===== AUTH ROUTES =====

    // Register with email/password
    app.post("/api/auth/register", authLimiter, async (req: Request, res: Response) => {
        try {
            const { email, password, firstName, lastName } = req.body;

            if (!email || !password) {
                return res.status(400).json({ message: "Email and password are required" });
            }

            if (password.length < 8) {
                return res.status(400).json({ message: "Password must be at least 8 characters" });
            }

            const emailLower = email.toLowerCase();

            const [existingUser] = await db
                .select()
                .from(users)
                .where(eq(users.email, emailLower));

            if (existingUser) {
                return res.status(400).json({ message: "Email already registered" });
            }

            const userId = generateUserId();
            const passwordHash = await hashPassword(password);
            const verificationToken = generateToken();
            const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

            await db.insert(users).values({
                id: userId,
                email: emailLower,
                passwordHash,
                firstName,
                lastName,
                emailVerified: false,
                emailVerificationToken: verificationToken,
                emailVerificationExpires: verificationExpires,
            });

            await storage.assignDemoOrgToUser(userId);

            // Auto-verify in development (optional, can be kept or removed based on preference)
            // if (process.env.NODE_ENV === "development") {
            //    await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
            // }

            res.status(201).json({
                message: "Account created. Please check your email to verify your account."
            });
        } catch (error) {
            console.error("Registration error:", error);
            res.status(500).json({ message: "Registration failed" });
        }
    });

    // Login with email/password
    app.post("/api/auth/login", authLimiter, (req: Request, res: Response, next: NextFunction) => {
        passport.authenticate("local", (err: Error, user: Express.User, info: { message: string }) => {
            if (err) {
                return res.status(500).json({ message: "Login failed" });
            }
            if (!user) {
                return res.status(401).json({ message: info?.message || "Invalid credentials" });
            }

            req.logIn(user, async (loginErr) => {
                if (loginErr) {
                    return res.status(500).json({ message: "Login failed" });
                }

                await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

                // Ensure user has a demo organization assigned
                try {
                    await storage.assignDemoOrgToUser(user.id);
                } catch (error) {
                    logger.error("[AUTH] Error assigning demo org on login", error instanceof Error ? error : new Error(String(error)), { userId: user.id });
                    // Don't fail login if org assignment fails, but log it
                }

                if (user.pendingTotpVerification) {
                    return res.json({
                        requires2FA: true,
                        message: "Please enter your 2FA code"
                    });
                }

                res.json({
                    message: "Login successful",
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        profileImageUrl: user.profileImageUrl,
                        emailVerified: user.emailVerified,
                    }
                });
            });
        })(req, res, next);
    });

    // Verify 2FA code after login
    app.post("/api/auth/verify-2fa", async (req: Request, res: Response) => {
        try {
            const user = req.user as Express.User;
            if (!user || !user.pendingTotpVerification) {
                return res.status(401).json({ message: "No pending 2FA verification" });
            }

            const { code } = req.body;
            if (!code) {
                return res.status(400).json({ message: "2FA code required" });
            }

            const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
            if (!dbUser || !dbUser.totpSecret) {
                return res.status(400).json({ message: "2FA not configured" });
            }

            const verified = speakeasy.totp.verify({
                secret: dbUser.totpSecret,
                encoding: "base32",
                token: code,
                window: 1,
            });

            if (!verified && dbUser.backupCodes) {
                const backupCodes = JSON.parse(dbUser.backupCodes) as string[];
                const codeIndex = backupCodes.indexOf(code.toUpperCase());
                if (codeIndex !== -1) {
                    backupCodes.splice(codeIndex, 1);
                    await db.update(users).set({ backupCodes: JSON.stringify(backupCodes) }).where(eq(users.id, user.id));
                } else {
                    return res.status(401).json({ message: "Invalid 2FA code" });
                }
            } else if (!verified) {
                return res.status(401).json({ message: "Invalid 2FA code" });
            }

            req.session.regenerate((err) => {
                if (err) {
                    return res.status(500).json({ message: "Session error" });
                }
                req.logIn({ ...user, pendingTotpVerification: false }, (loginErr) => {
                    if (loginErr) {
                        return res.status(500).json({ message: "Login error" });
                    }
                    res.json({
                        message: "2FA verified",
                        user: {
                            id: user.id,
                            email: user.email,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            profileImageUrl: user.profileImageUrl,
                        }
                    });
                });
            });
        } catch (error) {
            console.error("2FA verification error:", error);
            res.status(500).json({ message: "Verification failed" });
        }
    });

    // Google OAuth routes
    if (process.env.GOOGLE_CLIENT_ID) {
        app.get("/api/auth/google", passport.authenticate("google"));

        app.get("/api/auth/google/callback",
            passport.authenticate("google", { failureRedirect: "/login?error=google" }),
            (req: Request, res: Response) => {
                const user = req.user as Express.User;
                if (user?.pendingTotpVerification) {
                    res.redirect("/login?require2fa=true");
                } else {
                    res.redirect("/");
                }
            }
        );
    }

    // Logout
    app.post("/api/auth/logout", (req: Request, res: Response) => {
        req.logout((err) => {
            if (err) {
                logger.error("[AUTH] Logout error", err);
                return res.status(500).json({ message: "Logout failed" });
            }
            req.session.destroy((destroyErr) => {
                if (destroyErr) {
                    logger.error("[AUTH] Session destroy error", destroyErr);
                }
                // PERMANENT FIX: Clear the correct cookie name
                res.clearCookie(SESSION_COOKIE_NAME, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
                    path: "/",
                });
                // Also clear the default cookie name in case of migration issues
                res.clearCookie("connect.sid", { path: "/" });
                res.json({ message: "Logged out successfully" });
            });
        });
    });

    // Get current user
    app.get("/api/auth/me", async (req: Request, res: Response) => {
        // Dev mode bypass REMOVED to allow testing authentication
        /*
        if (process.env.NODE_ENV === "development") {
            // ... code ...
        }
        */

        // PERMANENT FIX: Better error handling for session issues
        try {
            if (!req.isAuthenticated() || !req.user) {
                // Check if session exists but user deserialization failed
                if (req.session && !req.user) {
                    logger.warn("[AUTH] Session exists but user deserialization failed - clearing session");
                    req.session.destroy(() => {});
                }
                return res.status(401).json({ message: "Not authenticated" });
            }

            const user = req.user as Express.User;
            if (user.pendingTotpVerification) {
                return res.status(401).json({ message: "2FA verification required", requires2FA: true });
            }

            res.json({
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                profileImageUrl: user.profileImageUrl,
                emailVerified: user.emailVerified,
                totpEnabled: user.totpEnabled,
            });
        } catch (error) {
            logger.error("[AUTH] Error in /api/auth/me", error);
            // Clear potentially corrupted session
            if (req.session) {
                req.session.destroy(() => {});
            }
            res.status(500).json({ message: "Authentication check failed" });
        }
    });

    // ===== 2FA SETUP ROUTES =====

    app.post("/api/auth/2fa/setup", isAuthenticated, async (req: Request, res: Response) => {
        try {
            const user = req.user as Express.User;

            const secret = speakeasy.generateSecret({
                name: `Ganttium (${user.email})`,
                length: 32,
            });

            await db.update(users).set({
                totpSecret: secret.base32
            }).where(eq(users.id, user.id));

            const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

            res.json({
                secret: secret.base32,
                qrCode,
            });
        } catch (error) {
            console.error("2FA setup error:", error);
            res.status(500).json({ message: "Failed to setup 2FA" });
        }
    });

    app.post("/api/auth/2fa/enable", isAuthenticated, async (req: Request, res: Response) => {
        try {
            const user = req.user as Express.User;
            const { code } = req.body;

            if (!code) {
                return res.status(400).json({ message: "Verification code required" });
            }

            const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
            if (!dbUser?.totpSecret) {
                return res.status(400).json({ message: "Please setup 2FA first" });
            }

            const verified = speakeasy.totp.verify({
                secret: dbUser.totpSecret,
                encoding: "base32",
                token: code,
                window: 1,
            });

            if (!verified) {
                return res.status(400).json({ message: "Invalid verification code" });
            }

            const backupCodes = generateBackupCodes();

            await db.update(users).set({
                totpEnabled: true,
                backupCodes: JSON.stringify(backupCodes),
            }).where(eq(users.id, user.id));

            res.json({
                message: "2FA enabled successfully",
                backupCodes,
            });
        } catch (error) {
            console.error("2FA enable error:", error);
            res.status(500).json({ message: "Failed to enable 2FA" });
        }
    });

    app.post("/api/auth/2fa/disable", isAuthenticated, async (req: Request, res: Response) => {
        try {
            const user = req.user as Express.User;
            const { password, code } = req.body;

            const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
            if (!dbUser) {
                return res.status(404).json({ message: "User not found" });
            }

            if (dbUser.passwordHash) {
                if (!password) {
                    return res.status(400).json({ message: "Password required" });
                }
                const validPassword = await verifyPassword(password, dbUser.passwordHash);
                if (!validPassword) {
                    return res.status(401).json({ message: "Invalid password" });
                }
            }

            if (dbUser.totpEnabled && dbUser.totpSecret) {
                if (!code) {
                    return res.status(400).json({ message: "2FA code required" });
                }
                const verified = speakeasy.totp.verify({
                    secret: dbUser.totpSecret,
                    encoding: "base32",
                    token: code,
                    window: 1,
                });
                if (!verified) {
                    return res.status(401).json({ message: "Invalid 2FA code" });
                }
            }

            await db.update(users).set({
                totpEnabled: false,
                totpSecret: null,
                backupCodes: null,
            }).where(eq(users.id, user.id));

            res.json({ message: "2FA disabled successfully" });
        } catch (error) {
            console.error("2FA disable error:", error);
            res.status(500).json({ message: "Failed to disable 2FA" });
        }
    });

    // ===== PASSWORD RESET =====

    app.post("/api/auth/forgot-password", passwordResetLimiter, async (req: Request, res: Response) => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ message: "Email required" });
            }

            const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));

            if (!user) {
                return res.json({ message: "If an account exists, a reset link will be sent" });
            }

            const resetToken = generateToken();
            const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

            await db.update(users).set({
                passwordResetToken: resetToken,
                passwordResetExpires: resetExpires,
            }).where(eq(users.id, user.id));

            if (process.env.NODE_ENV === "development") {
                console.log(`Password reset token for ${email}: ${resetToken}`);
            }

            res.json({ message: "If an account exists, a reset link will be sent" });
        } catch (error) {
            console.error("Forgot password error:", error);
            res.status(500).json({ message: "Request failed" });
        }
    });

    app.post("/api/auth/reset-password", passwordResetLimiter, async (req: Request, res: Response) => {
        try {
            const { token, password } = req.body;

            if (!token || !password) {
                return res.status(400).json({ message: "Token and password required" });
            }

            if (password.length < 8) {
                return res.status(400).json({ message: "Password must be at least 8 characters" });
            }

            const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token));

            if (!user || !user.passwordResetExpires || new Date() > user.passwordResetExpires) {
                return res.status(400).json({ message: "Invalid or expired reset token" });
            }

            const passwordHash = await hashPassword(password);

            await db.update(users).set({
                passwordHash,
                passwordResetToken: null,
                passwordResetExpires: null,
            }).where(eq(users.id, user.id));

            res.json({ message: "Password reset successfully" });
        } catch (error) {
            console.error("Reset password error:", error);
            res.status(500).json({ message: "Reset failed" });
        }
    });

    // ===== EMAIL VERIFICATION =====

    app.get("/api/auth/verify-email", async (req: Request, res: Response) => {
        try {
            const { token } = req.query;

            if (!token || typeof token !== "string") {
                return res.status(400).json({ message: "Invalid verification link" });
            }

            const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));

            if (!user || !user.emailVerificationExpires || new Date() > user.emailVerificationExpires) {
                return res.status(400).json({ message: "Invalid or expired verification link" });
            }

            await db.update(users).set({
                emailVerified: true,
                emailVerificationToken: null,
                emailVerificationExpires: null,
            }).where(eq(users.id, user.id));

            res.redirect("/login?verified=true");
        } catch (error) {
            console.error("Email verification error:", error);
            res.status(500).json({ message: "Verification failed" });
        }
    });

    app.get("/api/login", (req, res) => {
        res.redirect("/login");
    });
}

// Authentication middleware
export const isAuthenticated: RequestHandler = async (req, res, next) => {
    // Dev mode bypass REMOVED to allow testing authentication
    // if (process.env.NODE_ENV === "development") { ... }

    if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const user = req.user as Express.User;

    if (user.pendingTotpVerification) {
        return res.status(401).json({ message: "2FA verification required", requires2FA: true });
    }

    return next();
};
