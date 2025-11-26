import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Loader2, Lock, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ResetPasswordPage() {
    const [, setLocation] = useLocation();
    const [token, setToken] = useState<string | null>(null);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get token from URL
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenParam = urlParams.get("token");
        if (tokenParam) {
            setToken(tokenParam);
        }
    }, []);

    const resetPasswordMutation = useMutation({
        mutationFn: async (data: { token: string; password: string }) => {
            const response = await apiRequest("POST", "/api/auth/reset-password", data);
            return response.json();
        },
        onSuccess: () => {
            setSuccess(true);
            setError(null);
        },
        onError: (error: Error) => {
            setError(error.message || "Failed to reset password");
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }

        if (!token) {
            setError("Invalid reset link");
            return;
        }

        resetPasswordMutation.mutate({ token, password });
    };

    // No token provided
    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="flex justify-center mb-4">
                            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertCircle className="h-8 w-8 text-red-600" />
                            </div>
                        </div>
                        <CardTitle>Invalid Reset Link</CardTitle>
                        <CardDescription>
                            This password reset link is invalid or has expired.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/forgot-password">
                            <Button className="w-full">Request New Reset Link</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Success state
    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="flex justify-center mb-4">
                            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                            </div>
                        </div>
                        <CardTitle>Password Reset Successful</CardTitle>
                        <CardDescription>
                            Your password has been reset successfully. You can now log in with your new password.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/login">
                            <Button className="w-full">Go to Login</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
                            <Building2 className="h-8 w-8 text-primary-foreground" />
                        </div>
                    </div>
                    <CardTitle>Reset Password</CardTitle>
                    <CardDescription>
                        Enter your new password below.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">New Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Min 8 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10"
                                    minLength={8}
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="Re-enter password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-10"
                                    minLength={8}
                                    required
                                />
                            </div>
                        </div>
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={resetPasswordMutation.isPending}
                        >
                            {resetPasswordMutation.isPending ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting...</>
                            ) : (
                                "Reset Password"
                            )}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="justify-center">
                    <Link href="/login">
                        <Button variant="ghost">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Login
                        </Button>
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
