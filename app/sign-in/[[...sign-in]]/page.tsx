import {SignIn} from '@clerk/nextjs';import {PublicShell} from '@/components/legal';
export default function SignInPage(){return <PublicShell><main className="login-screen"><SignIn fallbackRedirectUrl="/"/></main></PublicShell>;}
